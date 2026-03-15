# Regras de Apresentação de Fotografias no Livro de Família

Este documento descreve o pipeline completo de processamento e apresentação de fotografias no Livro de Família (`livro.html`), desde a elegibilidade até ao ecrã final.

---

## Pipeline Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. ELEGIBILIDADE  (por cada multimedia item da pessoa)             │
│                                                                     │
│  mm.livroEligible === false  ──→  ✗ EXCLUÍDA                        │
│  src (dataUrl / files[0].file) vazio  ──→  ✗ EXCLUÍDA              │
│                                         │                           │
│                                         ↓ PASSA                     │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. RECOLHA DE ATRIBUTOS  (_renderBioPage)                          │
│                                                                     │
│  Para cada foto elegível extrai:                                    │
│    • src          → URL da imagem                                   │
│    • note         → texto das notas do multimedia (mm.notes)        │
│    • bbox         → pixelCoords da tag da pessoa (personTag)        │
│    • isCutout     → recorte/cutout de outra foto                    │
│    • isParentPhoto→ é a foto "mãe" de um cutout                     │
│    • isPrimary    → marcada como foto principal                     │
│    • isPersonal   → foto individual da pessoa                       │
│    • parentRin / photoRin → ID de relação cutout ↔ parent           │
│    • taggedCount  → nº de pessoas com bbox nessa foto               │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. DEDUPLICAÇÃO  (cutout vs. foto original)                        │
│                                                                     │
│  Se isCutout=true  E  foto "mãe" está presente no array            │
│    ──→  ✗ cutout DESCARTADO  (prevalece a foto original)            │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. PONTUAÇÃO E ORDENAÇÃO  (maior score primeiro)                   │
│                                                                     │
│   isPrimary           → +10  (foto principal explícita)             │
│   isPersonal          → +8   (foto individual da pessoa)            │
│   bbox presente       → +6   (tem zona de rosto marcada)            │
│   taggedCount === 1   → +3   (só esta pessoa está marcada)          │
│   !isCutout           → +1   (foto completa, não recorte)           │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. ENRIQUECIMENTO DO OBJETO FINAL                                  │
│                                                                     │
│   { src, note, bbox, isSolo }                                       │
│     isSolo = isPersonal  OU  (taggedCount===1 && bbox existe)       │
│              → indica foto de retrato individual vs. grupo          │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. PAGINAÇÃO / DISTRIBUIÇÃO POR PÁGINAS                            │
│                                                                     │
│  photoLimit = pessoa com notas longas (>200 chars) → 4              │
│             = caso contrário                        → 6             │
│                                                                     │
│  photosPage1  = fotos[0 .. photoLimit-1]  → página biográfica       │
│  photosExtra  = fotos[photoLimit ..]      → páginas de continuação  │
│                                                                     │
│  Páginas de continuação:                                            │
│    • chunks de 6 fotos por página                                   │
│    • MAX 2 páginas de continuação por pessoa                        │
│    → Total máximo: 1 bio + 2 continuação = 3 páginas de fotos       │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  7. MOSAICO (_renderPhotoMosaic)  — layout segundo nº de fotos      │
│                                                                     │
│   1 foto  → mosaico-1  (foto única, ocupa toda a área)              │
│   2 fotos → mosaico-2  (lado a lado, flex:1 cada)                   │
│   3 fotos → mosaico-3  (1 grande à esq + 2 empilhadas à dir)        │
│   4 fotos → mosaico-4  (grelha 2×2)                                 │
│   5-6 f.  → mosaico-5  (fila de 3 em cima + fila 2-3 em baixo)     │
│                                                                     │
│   Cada foto envolve:  .album-photo + cantos decorativos             │
│                       rotação aleatória (-2.5° a +2.5°)             │
└─────────────────────────────────────────────────────────────────────┘
                          │
                    ┌─────┴──────┐
                    ▼            ▼
      ┌─────────────────┐   ┌──────────────────────────────────────┐
      │  COM bbox?      │   │  SEM bbox                            │
      │  (zona de rosto)│   │  object-fit: cover                   │
      │                 │   │  object-position: center top         │
      │  _livroFaceCrop │   └──────────────────────────────────────┘
      │  onload         │
      └────────┬────────┘
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  8. FACE CROP  (_livroFaceCrop)  — regra: face NUNCA cortada        │
│                                                                     │
│  a) Calcula escala object-fit:cover (max(cw/nw, ch/nh))             │
│  b) Converte bbox para píxeis renderizados                          │
│  c) Centro ideal: face centrada + 35% headroom acima               │
│  d) Hard clamp: topo/base/esq/dir da face nunca saem da vista       │
│  e) Clamp final: não ultrapassar limites da imagem                  │
│  f) Converte offset para object-position em %                       │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  9. LEGENDAS / CAPTIONS                                             │
│                                                                     │
│  Se mm.notes existe → caption abaixo da foto no mosaico            │
│  (.photo-slot-caption)                                              │
│  Regra: notas de fotografia = legenda em rodapé                     │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  10. REGRAS EDITORIAIS (familybook-instructions.md)                 │
│                                                                     │
│  • Fotos recentes com muito contraste → tom sépia ligeiro           │
│    (sem perda de cor, para ar clássico)                             │
│                                                                     │
│  Fotos INDIVIDUAIS:                                                 │
│    • Cara nunca cortada  → garantido pelo face-crop (passo 8)       │
│    • Cara o mais centrada possível → object-position calculada      │
│                                                                     │
│  Fotos de GRUPO:                                                    │
│    • Pessoa identificada (com bbox) deve estar claramente visível   │
│    • Pode cortar outras pessoas se necessário                       │
│    • Não repetir na mesma página                                    │
│    • Não repetir no mesmo par de páginas (livro aberto)             │
└─────────────────────────────────────────────────────────────────────┘
                          │
            ┌─────────────┴──────────────┐
            ▼                            ▼
┌─────────────────────┐     ┌────────────────────────────────────────┐
│  GALERIA DE FOTOS   │     │  ÍNDICE DE FOTOGRAFIAS                 │
│  (_renderPhotoGallery)    │  (_renderIndexPhotos)                  │
│                     │     │                                        │
│  • Todas fotos únicas│    │  • Thumbnail + nome da pessoa          │
│    de todos os indivíduos │  • Título e nota do multimedia         │
│  • 2 fotos por página│    │  • Referência de página                │
│  • Caption: pessoas  │    │  • Deduplica por multimedia ID         │
│    identificadas +   │    └────────────────────────────────────────┘
│    nota da foto      │
│  • livroEligible≠false│
└─────────────────────┘
```

---

## Referência Rápida — Tabela de Atributos

| Atributo       | Fonte                          | Efeito                                      |
|----------------|--------------------------------|---------------------------------------------|
| `livroEligible`| `mm.livroEligible`             | `false` exclui a foto do livro              |
| `isPrimary`    | `objeProps.primary`            | Score +10, aparece sempre primeiro          |
| `isPersonal`   | `objeProps.personalPhoto`      | Score +8, `isSolo=true`                     |
| `bbox`         | `personTag.pixelCoords`        | Score +6, activa face-crop                  |
| `taggedCount`  | `mm.tags` com pixelCoords      | =1 → score +3, `isSolo=true`               |
| `isCutout`     | `objeProps.cutout`             | Score -1; descartado se pai presente        |
| `note`         | `mm.notes`                     | Exibido como caption sob a foto             |

## Referência Rápida — Limites de Páginas

| Situação                              | Fotos na pág. bio | Pág. continuação | Total |
|---------------------------------------|:-----------------:|:----------------:|:-----:|
| Pessoa com notas longas (>200 chars)  | 4                 | até 2 × 6        | 3 pág |
| Pessoa sem notas / notas curtas       | 6                 | até 2 × 6        | 3 pág |

## Referência Rápida — Score de Ordenação

```
score(foto) = (isPrimary ? 10 : 0)
            + (isPersonal ? 8 : 0)
            + (bbox ? 6 : 0)
            + (taggedCount === 1 ? 3 : 0)
            + (!isCutout ? 1 : 0)
```

Fotos com score mais alto aparecem **primeiro** no mosaico e na página biográfica.
