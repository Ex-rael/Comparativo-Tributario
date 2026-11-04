#!/usr/bin/env python3
"""Poda o vocabulário do BGE-M3 (ONNX) para os pedaços escritos só com caracteres do português e quantiza em int8.

Texto em português segmenta igual ao original: o tokenizador (Unigram) só usa pedaços com caracteres presentes
no texto. Caracteres de fora (ñ, ß, emoji) viram <unk>. Resultado medido: 2,27 GB (fp32) -> 389 MB (int8).

Uso: python3 scripts/bge-m3-podar.py ORIGEM SAIDA
  ORIGEM: pasta com model.onnx, model.onnx.data e tokenizer.json (ex.: newtechstudio/bge-m3-3head, MIT)
  SAIDA:  recebe model.onnx (int8), tokenizer.json (podado) e manter.json (id novo -> id original)
Requer: onnx, onnxruntime, numpy.
"""
import json, os, sys, time, numpy as np, onnx
from onnx import numpy_helper
from onnxruntime.quantization import quantize_dynamic, QuantType

D, O = (os.path.join(p, "") for p in sys.argv[1:3])
os.makedirs(O, exist_ok=True)
j = json.load(open(D + "tokenizer.json", encoding="utf-8"))
PT = set("abcdefghijklmnopqrstuvwxyzáàâãéêíóôõúüç"); PT |= {c.upper() for c in PT}
PT |= set("0123456789▁.,;:!?-–—'\"()[]/%&ºª°§$@#*+=<>_")
voc = j["model"]["vocab"]; especiais = {t["id"] for t in j["added_tokens"]}
manter = [i for i, (p, _) in enumerate(voc) if i in especiais or set(p) <= PT]
novo = {v: k for k, v in enumerate(manter)}
j["model"]["vocab"] = [voc[i] for i in manter]
for t in j["added_tokens"]: t["id"] = novo[t["id"]]
json.dump(j, open(O + "tokenizer.json", "w", encoding="utf-8"), ensure_ascii=False)
json.dump(manter, open(O + "manter.json", "w"))
print(f"vocabulário {len(voc)} -> {len(manter)}", flush=True)

m = onnx.load(D + "model.onnx")
for ini in m.graph.initializer:
    if len(ini.dims) == 2 and ini.dims[0] == len(voc):
        print("podando", ini.name, list(ini.dims), flush=True)
        ini.CopyFrom(numpy_helper.from_array(numpy_helper.to_array(ini)[manter], ini.name))
del m.graph.value_info[:]  # a inferência de formas do quantizador falha com o value_info do export
onnx.save(m, O + "fp32.onnx", save_as_external_data=True, location="fp32.onnx.data"); del m
t = time.time()
quantize_dynamic(O + "fp32.onnx", O + "model.onnx", weight_type=QuantType.QInt8, op_types_to_quantize=["MatMul", "Gather"])
for f in ("fp32.onnx", "fp32.onnx.data"): os.remove(O + f)
print(f"int8: {os.path.getsize(O + 'model.onnx') / 2**20:.1f} MB em {time.time() - t:.0f} s")
