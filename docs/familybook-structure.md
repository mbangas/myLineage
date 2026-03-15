# Estrutura do Livro de Família (Family History Book)

Este documento descreve como o `BookCompiler` (em `livro.html`) constrói e ordena as páginas do livro, desde a capa até à contra-capa.

---

## Diagrama Geral da Estrutura

```
╔══════════════════════════════════════════════════════════════════════╗
║                         LIVRO FECHADO                               ║
║               (StPageFlip — showCover: true)                        ║
╠══════════════════════════════════════════════════════════════════════╣
║  Pág 1   │  CAPA  (page-cover)                                      ║
║          │  Logo myLineage · Título · Apelidos da família · Ano     ║
╠══════════╪═════════════════════════════════════════════════════════╣
║  Pág 2   │  VERSO DA CAPA  (page-blank)                             ║
║          │  Página em branco                                        ║
╠══════════╪═════════════════════════════════════════════════════════╣
║  Pág 3   │  INTRODUÇÃO  (page-intro)                                ║
║          │  Texto introdutório (personalizável via bookIntro)        ║
╠══════════╪═════════════════════════════════════════════════════════╣
║  Pág 4   │  ÁRVORE GENEALÓGICA — metade esquerda  (page-full-tree)  ║
║  Pág 5   │  ÁRVORE GENEALÓGICA — metade direita   (page-full-tree)  ║
║          │  SVG com todas as pessoas do livro, dividido em spread   ║
║          │  Marcador de gerações + resumo estatístico               ║
╠══════════╪═════════════════════════════════════════════════════════╣
║          │                                                          ║
║  [repetido para cada família, por ordem de traversal]               ║
║          │                                                          ║
║  Pág N   │  CAPÍTULO ESQUERDO  (page-chapter)                       ║
║          │  ┌──────────────────────────────────────────────┐        ║
║          │  │ Cabeçalho: Nome do Casal / Família           │        ║
║          │  │ Data e local de casamento (se disponível)    │        ║
║          │  │ Mini-SVG da unidade familiar (pais + filhos) │        ║
║          │  │ Nota histórica contextual (opcional)         │        ║
║          │  └──────────────────────────────────────────────┘        ║
╠══════════╪═════════════════════════════════════════════════════════╣
║  Pág N+1 │  CAPÍTULO DIREITO  (page-bio)  — várias variantes:       ║
║          │                                                          ║
║          │  ▸ Variante A — Bio do lead (husb ou wife)               ║
║          │    + mini-bios dos filhos "lean" embutidos               ║
║          │                                                          ║
║          │  ▸ Variante B — Bio combinada (casal sem fotos)          ║
║          │    lead + cônjuge numa só página                         ║
║          │                                                          ║
║          │  ▸ Variante C — Bio do cônjuge                           ║
║          │    (quando lead já foi publicado noutro capítulo)        ║
╠══════════╪═════════════════════════════════════════════════════════╣
║  [0–2]   │  CONTINUAÇÃO DE FOTOS  (page-bio)  [opcional]            ║
║  páginas │  Fotos excedentes do lead que não couberam na bio        ║
║          │  Máx. 2 páginas de continuação × 6 fotos cada            ║
╠══════════╪═════════════════════════════════════════════════════════╣
║          │  BIO DO CÔNJUGE  (page-bio)  [quando não combinado]      ║
║          │  + continuações de foto (0–2) se houver fotos extras     ║
╠══════════╪═════════════════════════════════════════════════════════╣
║          │  BIOS DOS FILHOS  (page-bio)                             ║
║          │  ▸ Filhos COM fotos → página individual cada um          ║
║          │  ▸ Filhos SEM fotos → até 3 por página (batch)           ║
║          │  ▸ Filhos "lean" → mini-bio embutida no capítulo         ║
╠══════════╪═════════════════════════════════════════════════════════╣
║          │  [fim do bloco de família — próxima família repete]      ║
╠══════════╪═════════════════════════════════════════════════════════╣
║  [0–1]   │  BRANCO DE ALINHAMENTO  (page-blank)  [se total par]     ║
║  página  │  Garante contagem ímpar para contra-capa sozinha         ║
╠══════════╪═════════════════════════════════════════════════════════╣
║  Última  │  CONTRA-CAPA  (page-cover)                               ║
║          │  Espelho da capa: logo · título · apelidos · ano         ║
╚══════════╧═════════════════════════════════════════════════════════╝
```

---

## Partes Opcionais / Pendentes de Integração

Os seguintes componentes estão implementados como métodos do `BookCompiler` mas **ainda não são injectados** em `buildPages()`. Estão disponíveis para integração futura:

| Método                    | Tipo de página         | Descrição                                              |
|---------------------------|------------------------|--------------------------------------------------------|
| `_renderPhotoGallery()`   | `gallery`              | Galeria completa: todas as fotos únicas, 2 por página  |
| `_renderIndexGeneral()`   | `index-general`        | Índice de pessoas ordenado alfabeticamente             |
| `_renderIndexSurnames()`  | `index-surnames`       | Índice de apelidos com grupos por letra                |
| `_renderIndexPhotos()`    | `index-photos`         | Índice de fotografias com thumbnail + referência       |
| `_renderChronology()`     | `chrono`               | Tabela cronológica de todos os eventos, 30 por página  |
| `_renderIndicators()`     | `indicators`           | Estatísticas: total de pessoas, famílias, apelidos…    |

---

## Detalhe da Página Biográfica

```
┌──────────────────────────────────────────────────────┐
│  CABEÇALHO                                           │
│  Nome completo                          (chapter-heading)
│  Datas de vida (nascimento – morte)     (chapter-years)
│  Linha divisória                        (chapter-divider)
├──────────────────────────────────────────────────────┤
│  RELAÇÕES (bio-relations-wrap)                       │
│  Pais: …  |  Cônjuge: … (data casamento)  |  Filhos: …
├──────────────────────────────────────────────────────┤
│  EVENTOS  (bio-events)                               │
│  Lista de eventos de vida (excluindo BIRT e DEAT)    │
│  Cada evento: label + data + local + nota            │
├──────────────────────────────────────────────────────┤
│  NOTAS BIOGRÁFICAS  (bio-notes)  [se existirem]     │
│  Texto livre das notas da pessoa                     │
├──────────────────────────────────────────────────────┤
│  MOSAICO DE FOTOS  (bio-photo-area)                  │
│  1–6 fotos, layout adaptativo (ver photo-rules.md)  │
│  Legendas sob cada foto (se a foto tiver notas)      │
└──────────────────────────────────────────────────────┘
```

---

## Regras de Paginação dos Filhos

```
Filhos da família
       │
       ├── "Lean" (sem fotos, bio mínima, não é chapter-lead)
       │         └──→  mini-bio embutida no capítulo direito
       │
       ├── COM fotos
       │         └──→  página individual + continuações (máx 2)
       │
       └── SEM fotos (mas com info suficiente para não ser lean)
                 └──→  batch de até 3 por página (combined-bio)
                       se batch=1 → página individual normal
```

---

## Ordem de Traversal das Famílias

1. Famílias do **indivíduo raiz** (parâmetro `?person=ID`) são colocadas **primeiro**.
2. De seguida, todas as outras famílias pela ordem do traversal BFS/DFS da árvore.
3. Se uma pessoa já teve uma página biográfica publicada num capítulo anterior, **não é duplicada** — o capítulo seguinte publica o cônjuge como página direita.

---

## Modos do Livro

| Parâmetro URL        | Modo           | Traversal                                         |
|----------------------|----------------|---------------------------------------------------|
| `?complete=0` (omit) | Livro Família  | `traverseAllGenerations` — ancestrais + desc.     |
| `?complete=1`        | Livro Completo | `traverseComplete` — toda a árvore disponível     |

---

## Referências

- [Regras de fotos](familybook-photo-rules.md) — pipeline completo de elegibilidade e apresentação
- Código fonte: [livro.html](../livro.html) — classe `BookCompiler`, método `buildPages()`
- Instruções editoriais: [familybook-instructions.md](../.github/instructions/familybook-instructions.md)
