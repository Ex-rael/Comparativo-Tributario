#!/usr/bin/env python3
"""Avalia a busca semântica do BGE-M3: cada descrição de avaliacao/anexo-casos.jsonl recebe o rótulo do item de
avaliacao/anexo-lei.jsonl mais parecido (sem treino). Pontuação: denso, esparso e híbrido (denso + 0,3 x esparso).

Uso: python3 scripts/bge-m3-avaliar.py PASTA_DO_MODELO   (model.onnx + tokenizer.json)
Requer: onnxruntime, tokenizers, numpy.
"""
import json, os, sys, time, numpy as np, onnxruntime as ort
from tokenizers import Tokenizer

D = os.path.join(sys.argv[1], "")
AV = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "avaliacao", "")
ler = lambda n: [json.loads(l) for l in open(AV + n, encoding="utf-8")]
lei, casos = ler("anexo-lei.jsonl"), ler("anexo-casos.jsonl")
tok = Tokenizer.from_file(D + "tokenizer.json"); tok.enable_truncation(256)
s = ort.InferenceSession(D + "model.onnx", providers=["CPUExecutionProvider"])
ESPECIAIS = {0, 1, 2, 3}  # <s>, <pad>, </s>, <unk>

def vetores(txts, lote=8):
    dens, esp = [], []
    for i in range(0, len(txts), lote):
        enc = tok.encode_batch(txts[i:i + lote]); L = max(len(e.ids) for e in enc)
        ids = np.array([e.ids + [1] * (L - len(e.ids)) for e in enc], dtype=np.int64)
        m = np.array([[1] * len(e.ids) + [0] * (L - len(e.ids)) for e in enc], dtype=np.int64)
        d, sp = s.run(["dense", "sparse"], {"input_ids": ids, "attention_mask": m})
        dens.append(d / np.linalg.norm(d, axis=1, keepdims=True))
        for b, e in enumerate(enc):
            w = {}
            for t, v in zip(e.ids, sp[b][:len(e.ids)]):
                if t not in ESPECIAIS and v > 0: w[t] = max(w.get(t, 0.0), float(v))
            esp.append(w)
    return np.vstack(dens), esp

Kd, Ks = vetores([x["texto"] for x in lei])
t = time.perf_counter(); Qd, Qs = vetores([c["texto"] for c in casos]); ms = (time.perf_counter() - t) / len(casos) * 1000
lex = lambda a, b: sum(v * b[k] for k, v in a.items() if k in b)
Sd = Qd @ Kd.T; Ss = np.array([[lex(q, k) for k in Ks] for q in Qs])
rot = np.array([x["rotulo"] for x in lei]); ids = [x["id"] for x in lei]
print(f"{len(casos)} casos, {ms:.0f} ms por descrição (CPU, lote 8)")
for nome, S in (("denso", Sd), ("esparso", Ss), ("híbrido", Sd + 0.3 * Ss)):
    o = np.argsort(-S, 1); ok = np.array([rot[r[0]] == c["rotulo"] for r, c in zip(o, casos)])
    dif = {d: f"{ok[[c['dificuldade'] == d for c in casos]].mean():.0%}" for d in ("normal", "dificil")}
    rec = " | ".join(f"top-{k} {np.mean([c['inciso_lei'] in [ids[j] for j in r[:k]] for r, c in zip(o, casos)]):.0%}" for k in (1, 3, 10))
    marg = S[np.arange(len(casos)), o[:, 0]] - S[np.arange(len(casos)), o[:, 1]]
    ab = " | ".join(f"responde {np.mean(marg >= np.quantile(marg, q)):.0%}, acerta {ok[marg >= np.quantile(marg, q)].mean():.0%}" for q in (0.25, 0.5))
    print(f"\n{nome}: acerto {ok.mean():.1%} {dif}\n  inciso certo: {rec}\n  abstenção por margem: {ab}")
