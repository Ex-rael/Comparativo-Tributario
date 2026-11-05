#!/usr/bin/env python3
"""Gera modelo/lei-vetores.json: os vetores BGE-M3 (denso e esparso) dos itens de avaliacao/anexo-lei.jsonl, que a
página compara com a descrição do operador. Gera também spike/bge-esperado.json, o gabarito do Python (tokens e
3 primeiros itens de cada caso) para conferir o navegador.

Uso: python3 scripts/bge-m3-vetores-lei.py PASTA_DO_MODELO REPO_HF REVISAO
O modelo precisa ser o mesmo que a página carrega (mesmo repositório e revisão).
"""
import json, os, sys, datetime, numpy as np, onnxruntime as ort
from tokenizers import Tokenizer

D, REPO, REV = os.path.join(sys.argv[1], ""), sys.argv[2], sys.argv[3]
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ler = lambda n: [json.loads(l) for l in open(os.path.join(RAIZ, "avaliacao", n), encoding="utf-8")]
lei, casos = ler("anexo-lei.jsonl"), ler("anexo-casos.jsonl")
tok = Tokenizer.from_file(D + "tokenizer.json"); tok.enable_truncation(256)
s = ort.InferenceSession(D + "model.onnx", providers=["CPUExecutionProvider"])
ESPECIAIS = {0, 1, 2, 3}

def vetor(txt):
    e = tok.encode(txt); ids = np.array([e.ids], dtype=np.int64)
    d, sp = s.run(["dense", "sparse"], {"input_ids": ids, "attention_mask": np.ones_like(ids)})
    w = {}
    for t, v in zip(e.ids, sp[0]):
        if t not in ESPECIAIS and v > 0: w[t] = max(w.get(t, 0.0), float(v))
    return e.ids, d[0] / np.linalg.norm(d[0]), w

itens, K = [], []
for x in lei:
    _, d, w = vetor(x["texto"]); K.append((d, w))
    itens.append({"id": x["id"], "rotulo": x["rotulo"], "fonte": x["fonte"], "texto": x["texto"],
                  "d": [round(float(v), 5) for v in d], "s": {str(k): round(v, 4) for k, v in w.items()}})
meta = {"modelo": REPO, "revisao": REV, "gerado_em": datetime.date.today().isoformat(), "peso_esparso": 0.3,
        "origem": "avaliacao/anexo-lei.jsonl (LC 123/2006, arts. 17 e 18)", "gerador": "scripts/bge-m3-vetores-lei.py"}
json.dump({"metadata": meta, "itens": itens}, open(os.path.join(RAIZ, "modelo", "lei-vetores.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))

esperado = []
for c in casos:
    ids, d, w = vetor(c["texto"])
    sc = [float(d @ kd) + 0.3 * sum(v * kw[t] for t, v in w.items() if t in kw) for kd, kw in K]
    top = sorted(range(len(sc)), key=lambda i: -sc[i])[:3]
    esperado.append({"id": c["id"], "texto": c["texto"], "rotulo": c["rotulo"], "dificuldade": c["dificuldade"],
                     "ids": ids, "top3": [lei[i]["id"] for i in top], "pont": [round(sc[i], 4) for i in top]})
json.dump({"metadata": meta, "casos": esperado}, open(os.path.join(RAIZ, "spike", "bge-esperado.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
ok = sum(next(x["rotulo"] for x in lei if x["id"] == e["top3"][0]) == e["rotulo"] for e in esperado)
print(f"{len(itens)} itens da lei, {len(esperado)} casos; acerto do gabarito {ok}/{len(esperado)} = {ok/len(esperado):.1%}")
