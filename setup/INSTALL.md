# 🌳 myLineage — Guia de Instalação

> **Para toda a gente** — Este guia foi escrito para qualquer pessoa, mesmo sem conhecimentos técnicos. Siga os passos na ordem indicada e a aplicação ficará pronta a usar.

---

## O que é o myLineage?

O **myLineage** é uma aplicação de genealogia familiar que funciona no seu servidor (ou computador). Permite registar pessoas, famílias, datas e eventos, visualizar árvores genealógicas interativas e importar/exportar ficheiros GEDCOM — o formato padrão de genealogia.

---

## O que o instalador faz?

O instalador executa automaticamente, sem necessidade de saber programar:

| Passo | O que acontece |
|-------|---------------|
| **1** | Actualiza o sistema operativo (instala as últimas actualizações de segurança) |
| **2** | Instala o **Docker** — o motor que executa a aplicação em contentores isolados |
| **3** | Instala o **Portainer** — uma interface web para gerir o Docker visualmente |
| **4** | Cria as pastas nos volumes de dados (fotografias, documentos, GEDCOM) |
| **5** | Descarrega o código do **myLineage** do GitHub |
| **6** | Cria os ficheiros de configuração do Docker (`Dockerfile` e `docker-compose.yml`) |
| **7** | Compila e inicia a aplicação |
| **8** | Verifica se tudo está a funcionar |

---

## Antes de começar — Requisitos

### Onde instalar?

O instalador foi criado para ser executado num **LXC no Proxmox** acabado de criar.  
Funciona com as seguintes versões:

| Sistema Operativo | Versão Recomendada |
|------------------|--------------------|
| **Debian** ✅ *(recomendado)* | 12 (Bookworm) |
| **Debian** | 11 (Bullseye) |
| **Ubuntu** | 22.04 LTS (Jammy) |
| **Ubuntu** | 24.04 LTS (Noble) |

> 💡 **Recomendação:** Use **Debian 12** — é a opção mais leve e estável para servidores.

### Criar o LXC no Proxmox

1. No Proxmox, vá a **Create CT** (Criar Contentor)
2. Escolha o template **Debian 12** (ou Ubuntu 22.04)
3. Defina recursos mínimos recomendados:
   - **CPU:** 2 núcleos
   - **RAM:** 1024 MB (1 GB)
   - **Disco:** 20 GB
4. Ative a opção **"Nesting"** nas funcionalidades (necessário para Docker dentro do LXC):
   - Em *Options → Features → Nesting* → marque a caixa
5. Inicie o LXC e aceda à consola

### Acesso ao LXC

Pode aceder ao LXC de duas formas:

- **Consola do Proxmox** — clique no LXC e depois em "Console"
- **SSH** — `ssh root@<IP-do-LXC>`

---

## Instalação — Passo a Passo

### 1. Aceder ao LXC

Abra a consola do LXC (no Proxmox) ou ligue via SSH:

```bash
ssh root@<IP-do-LXC>
```

> Substitua `<IP-do-LXC>` pelo endereço IP do seu LXC (visível no Proxmox).

---

### 2. Descarregar o instalador

Execute este comando para descarregar o instalador directamente do GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/mbangas/myLineage/main/setup/install.sh -o install.sh
```

---

### 3. Executar o instalador

```bash
sudo bash install.sh
```

> Se já estiver como `root`, basta `bash install.sh`.

---

### 4. Seguir o assistente de instalação

O instalador abre um **ecrã azul interactivo** que o guia em cada passo:

#### Ecrã 1 — Boas-vindas
Apresenta o nome da solução e o resumo do que vai ser instalado. Prima **OK** para continuar.

#### Ecrã 2 — Confirmação
Confirme que pretende prosseguir com a instalação. Prima **Sim**.

#### Ecrã 3 — Porta da Aplicação
Define em que porta a aplicação ficará disponível.  
**Deixe o valor padrão `3000`** salvo se tiver um motivo específico para mudar.

#### Ecrã 4 — Directório de Instalação
Pasta onde o código será descarregado.  
**Deixe o valor padrão `/opt/mylineage`** salvo indicação contrária.

#### Ecrã 5, 6, 7, 8 — Volumes de Dados
Serão perguntados quatro caminhos para guardar os dados da aplicação:

| Volume | Para que serve | Valor padrão |
|--------|---------------|--------------|
| 📸 **Fotografias** | Imagens das pessoas | `/data/mylineage/fotos` |
| 📄 **Documentos** | PDFs e documentos digitalizados | `/data/mylineage/documentos` |
| 🗂️ **GEDCOM** | Ficheiros `.ged` de importação/exportação | `/data/mylineage/gedcom` |
| 🗄️ **Dados JSON** | Base de dados da aplicação | `/data/mylineage/data` |

> ⚠️ **Importante:** A pasta de **Dados JSON** é o coração da aplicação. Faça backups regulares desta pasta!

**Pode aceitar os valores padrão** em todos os volumes pressionando **Enter** em cada ecrã.  
No final, confirme a lista de volumes.

#### Ecrã 9 — Barra de Progresso
O instalador executa todos os passos automaticamente mostrando o progresso em tempo real. **Não é necessário fazer nada** — aguarde até a barra chegar a 100%.

> ⏱️ A instalação demora tipicamente **5 a 15 minutos** dependendo da velocidade da ligação à Internet.

---

### 5. Instalação concluída!

Quando a barra de progresso chegar a 100%, aparece o ecrã final com todas as informações de acesso.

---

## Como aceder à aplicação

Depois de instalada, a aplicação fica acessível através do browser:

### 🌳 myLineage (A aplicação)

```
http://<IP-do-LXC>:3000
```

| Secção | URL |
|--------|-----|
| **Página Principal** | `http://<IP-do-LXC>:3000` |
| **Cadastro de Pessoas** | `http://<IP-do-LXC>:3000/app.html` |
| **Árvore Genealógica** | `http://<IP-do-LXC>:3000/arvore.html` |
| **Galeria de Fotos** | `http://<IP-do-LXC>:3000/album.html` |
| **Documentos** | `http://<IP-do-LXC>:3000/documentos.html` |
| **GEDCOM** | `http://<IP-do-LXC>:3000/gedcom.html` |
| **Referência das APIs** | `http://<IP-do-LXC>:3000/apis.html` |

---

### 🐳 Portainer (Gestão do Docker)

O Portainer permite gerir visualmente a aplicação (ver logs, reiniciar, etc.):

```
https://<IP-do-LXC>:9443
```

> ⚠️ **Na primeira visita:** o browser pode mostrar um aviso de "ligação não segura" — clique em **Avançado → Continuar mesmo assim**. Isto é normal porque o certificado é auto-assinado.

**Na primeira vez que aceder ao Portainer:**
1. Crie um utilizador administrador (escolha um nome e palavra-passe)
2. Escolha **"Get Started"** para gerir o ambiente local
3. Clique em **"local"** para ver os contentores Docker

---

## Comandos úteis (na linha de comando)

Se precisar de gerir a aplicação depois da instalação:

```bash
# Ver os logs da aplicação em tempo real
docker logs mylineage -f

# Parar a aplicação
docker compose -f /opt/mylineage/docker-compose.yml down

# Reiniciar a aplicação
docker compose -f /opt/mylineage/docker-compose.yml restart

# Actualizar para a versão mais recente
cd /opt/mylineage
git pull
docker compose up -d --build

# Ver o estado dos contentores
docker ps

# Ver quanto espaço os volumes ocupam
du -sh /data/mylineage/
```

---

## Fazer backup dos dados

Os dados estão na pasta que indicou como **"Dados JSON"** (por padrão `/data/mylineage/data`).

Para fazer um backup simples:

```bash
# Criar backup com data
tar -czf mylineage_backup_$(date +%Y%m%d).tar.gz /data/mylineage/data /data/mylineage/fotos /data/mylineage/documentos
```

Guarde este ficheiro `.tar.gz` num local seguro (outro disco, cloud, etc.).

---

## Resolução de problemas

### A barra de progresso parou / erro durante a instalação

Consulte o log de instalação que foi gerado:

```bash
cat /tmp/mylineage_install_*.log
```

### Não consigo aceder à aplicação no browser

1. Verifique se o contentor está a correr: `docker ps`
2. Verifique os logs: `docker logs mylineage`
3. Confirme que a porta 3000 não está bloqueada pela firewall do Proxmox

### A aplicação abre mas fica em branco

Aguarde 30 segundos e recarregue a página — pode estar a iniciar.

### Preciso de reinstalar

```bash
# Parar e remover os contentores (os dados nos volumes NÃO são apagados)
docker compose -f /opt/mylineage/docker-compose.yml down
docker rmi mylineage:latest

# Re-executar o instalador
sudo bash install.sh
```

---

## Estrutura criada após instalação

```
/opt/mylineage/              ← Código da aplicação (git clone)
  ├── server.js
  ├── *.html
  ├── Dockerfile
  ├── docker-compose.yml     ← Gerado pelo instalador
  └── ...

/data/mylineage/             ← Dados persistentes (não apagar!)
  ├── data/                  ← Base de dados JSON (⭐ fazer backups!)
  ├── fotos/                 ← Fotografias
  ├── documentos/            ← Documentos
  └── gedcom/                ← Ficheiros GEDCOM
```

---

## Informação técnica (opcional)

| Componente | Versão | Porta |
|-----------|--------|-------|
| **myLineage** | 2.0 | 3000 |
| **Node.js** (dentro do Docker) | 18 LTS (Alpine) | — |
| **Docker CE** | última estável | — |
| **Portainer CE** | última estável | 9443 (HTTPS) |

O installer é compatível com **Debian 11/12** e **Ubuntu 22.04/24.04** e detecta automaticamente qual o sistema para usar o repositório Docker correcto.

---

<div align="center">

**🌳 myLineage** · Genealogia Familiar · GEDCOM 7  
[GitHub](https://github.com/mbangas/myLineage)

</div>
