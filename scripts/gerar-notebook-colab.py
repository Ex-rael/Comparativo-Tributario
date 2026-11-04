#!/usr/bin/env python3
"""Gera treino/laya-colab.ipynb: ajuste fino completo do LAYA multilíngue no Google Colab (GPU T4).

Uso: python3 scripts/gerar-notebook-colab.py
As células ficam aqui como texto para o notebook ser revisável no diff.
"""
import json, os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
celulas = []
md = lambda s: celulas.append(("markdown", s.strip("\n")))
py = lambda s: celulas.append(("code", s.strip("\n")))

md(r"""
# Ajuste fino do LAYA para o anexo do Simples Nacional

Teste da fase 2 do [plano do modelo de decisão](https://github.com/Ex-rael/Comparativo-Tributario/blob/main/docs/plano-modelo-decisao.md).

**Antes de rodar:** menu *Ambiente de execução → Alterar o tipo de ambiente de execução → GPU T4*. Depois, *Executar tudo*.

O que o notebook faz:
1. Baixa as bases de `avaliacao/` do repositório (texto da LC 123, IBGE e casos sintéticos; **nenhum dado de cliente**).
2. Baixa o LAYA multilíngue (`convaiinnovations/laya`, pasta `multilingual`, revisão fixa).
3. Validação cruzada em 5 rodadas, agrupada por inciso da lei: cada rodada treina o modelo inteiro e avalia nos casos de incisos que ficaram fora do treino.
4. Mostra o acerto geral, por dificuldade e com abstenção. **Meta: 80%.** Linha de base sem modelo: 67,4% geral; 85,1% respondendo 48,6% dos casos.
5. (Opcional, última seção) Treina com tudo, exporta para ONNX int8 e gera um `.zip` para baixar.

Tempo estimado na T4: ~5 min de preparo + ~20 min para as 5 rodadas.
""")

py(r"""
import subprocess, torch
print(subprocess.run(["nvidia-smi", "-L"], capture_output=True, text=True).stdout or "sem nvidia-smi")
assert torch.cuda.is_available(), "Sem GPU: mude o ambiente de execução para GPU T4."
print(torch.__version__, torch.cuda.get_device_name(0))
""")

py(r"""
!pip install -q laya==0.4.22
""")

md("## Configuração")
py(r"""
REPO = "https://raw.githubusercontent.com/Ex-rael/Comparativo-Tributario/main/avaliacao/"
MODELO = "convaiinnovations/laya"
REVISAO = "7b928d828b7b0e022f929d9bd2e44165aa270148"  # mesma revisão usada nos testes locais
EPOCAS, MICRO_LOTE, ACUMULO = 8, 8, 1
SEMENTE_DOBRAS = 7

# Pergunta tipada. Cada critério cabe no limite de 48 tokens por opção.
Q = {"anexo": {"type": "choice",
  "instructions": "Em qual enquadramento do Simples Nacional esta atividade se encaixa?",
  "criteria": {
    "I": "comércio, revenda de mercadorias compradas de terceiros",
    "II": "indústria, fabricação ou transformação de produtos",
    "III": "serviços como ensino, viagens, academias, manutenção, transporte municipal, contabilidade",
    "IV": "construção civil, obras, limpeza, vigilância, conservação, advocacia",
    "III_ou_V_fator_r": "serviços intelectuais ou técnicos: medicina, engenharia, TI, consultoria, publicidade, auditoria",
    "vedado": "atividade proibida no Simples: banco, factoring, locação de imóvel próprio, cessão de mão de obra, transporte intermunicipal",
  }}}
""")

md("## Bases e dobras")
py(r"""
import json, random, collections, os, re, urllib.request
ler = lambda n: [json.loads(l) for l in urllib.request.urlopen(REPO + n).read().decode().splitlines() if l.strip()]
lei, casos, ibge = ler("anexo-lei.jsonl"), ler("anexo-casos.jsonl"), ler("cnae-ibge.jsonl")
print(len(lei), "itens da lei |", len(casos), "casos |", len(ibge), "pares IBGE")

rnd = random.Random(SEMENTE_DOBRAS)
# Fora da amostra por regra: o que o art. 17 (VIII e X) pode vedar mesmo dentro de comércio ou indústria.
VEDA = re.compile(r"cigarr|charut|fumo|tabaco|arma|muni[cç]|p[oó]lvora|explosiv|detonant|bebida|cervej|chope|vinho|vin[ií]c|aguardente|cacha[cç]|licor|destil|autom[oó]v|motocicl|combust", re.I)
def regra(c):
    d, g = c[:2], c[:3]
    if d in ("45", "46", "47") and g != "452": return "I"
    if "10" <= d <= "33": return "II"
ib = collections.defaultdict(list)
for x in ibge:
    r = regra(x["cnae"].replace(".", "").replace("-", "").replace("/", ""))
    if r and not VEDA.search(x["texto"]): ib[r].append(x["texto"].lower())
extra = [(t, r) for r in ib for t in rnd.sample(ib[r], 40)]

grupos = sorted({c["inciso_lei"] for c in casos}); rnd.shuffle(grupos)
dobra = {g: i % 5 for i, g in enumerate(grupos)}
ex = lambda t, r: {"state": t, "questions": Q, "expected": {"anexo": r}}
os.makedirs("dobras", exist_ok=True)
for k in range(5):
    tr = [ex(x["texto"], x["rotulo"]) for x in lei] + [ex(t, r) for t, r in extra] + \
         [ex(c["texto"], c["rotulo"]) for c in casos if dobra[c["inciso_lei"]] != k]
    te = [dict(ex(c["texto"], c["rotulo"]), id=c["id"], dificuldade=c["dificuldade"]) for c in casos if dobra[c["inciso_lei"]] == k]
    rnd.shuffle(tr)
    for n, d in (("treino", tr), ("teste", te)):
        with open(f"dobras/{n}-{k}.jsonl", "w") as f: f.writelines(json.dumps(x, ensure_ascii=False) + "\n" for x in d)
    print(f"dobra {k}: treino {len(tr)}, teste {len(te)}", dict(collections.Counter(x["expected"]["anexo"] for x in te)))
""")

md("## Modelo base")
py(r"""
from huggingface_hub import snapshot_download
BASE = os.path.join(snapshot_download(MODELO, revision=REVISAO, allow_patterns=["multilingual/*"]), "multilingual")
print(BASE, os.listdir(BASE))
""")

md("## Validação cruzada (5 rodadas)")
py(r"""
import time, gc, shutil, laya

def treinar(dados, saida, avaliacao=None):
    cmd = ["laya-train", "--data", dados, "--base", BASE, "--out", saida, "--shuffle-options",
           "--epochs", str(EPOCAS), "--micro-batch", str(MICRO_LOTE), "--grad-accum", str(ACUMULO), "--device", "cuda"]
    if avaliacao: cmd += ["--eval", avaliacao]
    p = subprocess.run(cmd, capture_output=True, text=True)
    linhas = [l for l in (p.stdout + p.stderr).replace("\r", "\n").splitlines() if "epoch" in l or "Accuracy" in l or "Error" in l]
    print("\n".join(linhas[-12:]))
    if p.returncode: raise RuntimeError((p.stdout + p.stderr)[-3000:])

resultados = []
for k in range(5):
    t = time.time()
    treinar(f"dobras/treino-{k}.jsonl", f"ft-{k}", f"dobras/teste-{k}.jsonl")
    ag = laya.load(f"ft-{k}", device="cuda")
    for x in map(json.loads, open(f"dobras/teste-{k}.jsonl")):
        r = ag.predict(x["state"], Q)["answers"]["anexo"]
        resultados.append({"dobra": k, "id": x["id"], "dificuldade": x["dificuldade"], "rotulo": x["expected"]["anexo"],
                           "previsto": r["choice"], "confianca": max(r["probabilities"].values()), "prob": r["probabilities"]})
    del ag; gc.collect(); torch.cuda.empty_cache(); shutil.rmtree(f"ft-{k}")
    acc = sum(r["previsto"] == r["rotulo"] for r in resultados if r["dobra"] == k) / sum(r["dobra"] == k for r in resultados)
    print(f"== dobra {k}: acerto {acc:.1%} em {time.time() - t:.0f} s ==\n")
with open("resultados-cv.jsonl", "w") as f: f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in resultados)
""")

md("## Resultado")
py(r"""
n = len(resultados); ok = lambda rs: sum(r["previsto"] == r["rotulo"] for r in rs)
print(f"Acerto geral: {ok(resultados)}/{n} = {ok(resultados)/n:.1%}   (meta 80%; linha de base 67,4%)")
for d in sorted({r["dificuldade"] for r in resultados}):
    rs = [r for r in resultados if r["dificuldade"] == d]; print(f"  {d}: {ok(rs)}/{len(rs)} = {ok(rs)/len(rs):.1%}")
print("\nPor rótulo:")
for c in Q["anexo"]["criteria"]:
    rs = [r for r in resultados if r["rotulo"] == c]
    if rs: print(f"  {c}: {ok(rs)}/{len(rs)} = {ok(rs)/len(rs):.1%}")
print("\nCom abstenção (responde só acima da confiança mínima; o resto vai para revisão):")
for lim in (0.4, 0.5, 0.6, 0.7, 0.8, 0.9):
    rs = [r for r in resultados if r["confianca"] >= lim]
    if rs: print(f"  confiança ≥ {lim:.1f}: responde {len(rs)/n:.1%} dos casos, acerta {ok(rs)/len(rs):.1%}")
print("\nConfusão (rótulo → previsto):")
for (a, b), m in collections.Counter((r["rotulo"], r["previsto"]) for r in resultados if r["previsto"] != r["rotulo"]).most_common():
    print(f"  {a} → {b}: {m}")
""")

md(r"""
## Opcional: modelo final em ONNX int8

Rode só se o resultado acima for bom. Treina com **todas** as bases (sem caso de teste de fora; o acerto de referência é o da validação cruzada), exporta para ONNX, quantiza em int8 e gera `laya-anexo-onnx.zip` para baixar.
""")
py(r"""
!pip install -q onnx onnxruntime onnxscript
import onnx, numpy as np, onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType
from laya.common import build_sequence

with open("tudo.jsonl", "w") as f:
    for x in [ex(x["texto"], x["rotulo"]) for x in lei] + [ex(t, r) for t, r in extra] + [ex(c["texto"], c["rotulo"]) for c in casos]:
        f.write(json.dumps(x, ensure_ascii=False) + "\n")
treinar("tudo.jsonl", "ft-final")

ag = laya.load("ft-final", device="cpu"); m = ag.model.float().eval()
class W(torch.nn.Module):
    def __init__(s, m): super().__init__(); s.m = m
    def forward(s, input_ids, attention_mask, marker_pos, marker_mask, qtype):
        return s.m(input_ids, attention_mask, marker_pos, marker_mask, qtype)
ids, mk = build_sequence(ag.tok, "loja de roupas no centro", {"t": "choice", "ins": "Qual anexo?", "crit": {"A": "a", "B": "b", "C": "c"}},
                         ag.cfg["max_len"], ag.cfg["head_max_len"])
exemplo = (torch.tensor([ids, ids]), torch.ones(2, len(ids), dtype=torch.long), torch.tensor([mk, mk]),
           torch.ones(2, len(mk), dtype=torch.bool), torch.zeros(2, dtype=torch.long))
B, L, K = torch.export.Dim("B"), torch.export.Dim("L", max=ag.cfg["max_len"]), torch.export.Dim("K", min=2, max=64)
os.makedirs("onnx", exist_ok=True)
torch.onnx.export(W(m).eval(), exemplo, "onnx/fp32.onnx", dynamo=True, opset_version=18, external_data=False,
    input_names=["input_ids", "attention_mask", "marker_pos", "marker_mask", "qtype"], output_names=["logits", "act_logits"],
    dynamic_shapes={"input_ids": {0: B, 1: L}, "attention_mask": {0: B, 1: L}, "marker_pos": {0: B, 1: K},
                    "marker_mask": {0: B, 1: K}, "qtype": {0: B}})
g = onnx.load("onnx/fp32.onnx"); del g.graph.value_info[:]; onnx.save(g, "onnx/fp32.onnx")  # a inferência de formas do quantizador falha com o value_info do export
quantize_dynamic("onnx/fp32.onnx", "onnx/laya.onnx", weight_type=QuantType.QInt8, op_types_to_quantize=["MatMul", "Gather"])
print("int8:", round(os.path.getsize("onnx/laya.onnx") / 2**20, 1), "MB")

# Concordância int8 × PyTorch nos casos (dentro do treino: mede só a perda da quantização)
oa = laya.load("ft-final", backend="onnx", onnx_path="onnx/laya.onnx")
iguais = sum(ag.predict(c["texto"], Q)["answers"]["anexo"]["choice"] == oa.predict(c["texto"], Q)["answers"]["anexo"]["choice"] for c in casos)
print(f"Concordância int8 × PyTorch: {iguais}/{len(casos)} = {iguais/len(casos):.1%}")
""")
py(r"""
shutil.copytree("ft-final/tokenizer", "onnx/tokenizer", dirs_exist_ok=True)
for a in ("rl_agent_config.json", "questions.json", "train_report.json"):
    if os.path.exists(f"ft-final/{a}"): shutil.copy(f"ft-final/{a}", "onnx/")
shutil.copy("resultados-cv.jsonl", "onnx/")
os.remove("onnx/fp32.onnx")
shutil.make_archive("laya-anexo-onnx", "zip", "onnx")
print(round(os.path.getsize("laya-anexo-onnx.zip") / 2**20, 1), "MB")
from google.colab import files
files.download("laya-anexo-onnx.zip")
""")

nb = {"nbformat": 4, "nbformat_minor": 5,
      "metadata": {"accelerator": "GPU", "colab": {"gpuType": "T4", "provenance": []},
                   "kernelspec": {"name": "python3", "display_name": "Python 3"}, "language_info": {"name": "python"}},
      "cells": []}
for i, (tipo, src) in enumerate(celulas):
    c = {"cell_type": tipo, "id": f"c{i:02d}", "metadata": {}, "source": src.splitlines(keepends=True)}
    if tipo == "code": c.update(execution_count=None, outputs=[])
    nb["cells"].append(c)
destino = os.path.join(RAIZ, "treino", "laya-colab.ipynb")
os.makedirs(os.path.dirname(destino), exist_ok=True)
with open(destino, "w", encoding="utf-8") as f: json.dump(nb, f, ensure_ascii=False, indent=1); f.write("\n")
print("gerado", destino, len(celulas), "células")
