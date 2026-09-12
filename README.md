# NERVA — Neurological Event & Regimen Verification Assistant

Sistema de apoio à adesão medicamentosa e monitoramento clínico em epilepsia, desenvolvido como Trabalho de Conclusão de Curso em Ciência da Computação para o Centro Universitário Unifacvest

## 📋 Visão Geral

O NERVA é uma aplicação web de Digital Health que auxilia pacientes com epilepsia a:

- **Gerenciar medicamentos** — cadastro de medicamentos com horários e cores de identificação
- **Registrar doses** — marcação de doses tomadas, puladas ou perdidas (com geração automática diária)
- **Acompanhar adesão** — taxa de adesão calculada com base em doses tomadas vs. perdidas/puladas
- **Monitorar crises** — registro de crises epilépticas com tipo, duração, gravidade e gatilhos
- **Acompanhar sono** — registro de horas e qualidade do sono (fator de risco para crises)
- **Rastrear efeitos colaterais** — registro de efeitos adversos dos medicamentos
- **Visualizar epidemiologia** — painel administrativo com visão agregada de pacientes (perfil admin/clinico)

## 🏗️ Arquitetura

### Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS + shadcn/ui |
| Backend | Base44 (Backend-as-a-Service) |
| Banco de Dados | Base44 (PostgreSQL gerenciado) |
| Autenticação | Base44 Auth (email/senha, Google OAuth, OTP) |
| Segurança | Row-Level Security (RLS) por entidade |
| Internacionalização | i18n customizado (7 idiomas) |
| Gráficos | Recharts |
| Ícones | Lucide React |

### Modelo de Dados

O sistema possui 6 entidades principais, todas com Row-Level Security (RLS) para isolamento de dados:

```
User (built-in)
├── role: admin | user
├── profile: admin | patient
├── language: string (preferência de idioma, persistida no DB)
├── theme: light | dark (persistido no DB)
└── preferences: object (notificações, segurança, privacidade — persistido no DB)

Medication
├── name, dosage, frequency, times[], color, notes, active
└── RLS: paciente vê apenas seus medicamentos; admin vê todos

DoseLog
├── medication_id, medication_name, scheduled_date, scheduled_time
├── status: pending | taken | missed | skipped
├── taken_at (timestamp real de tomada)
└── RLS: paciente vê apenas suas doses; admin vê todas

Seizure
├── date_time, type, duration_minutes, severity, triggers[], notes
└── RLS: paciente vê apenas suas crises; admin vê todas

SleepRecord
├── date, hours, quality, bedtime, wake_time, notes
└── RLS: paciente vê apenas seus registros; admin vê todos

SideEffect
├── date, medication_id, medication_name, description, severity, notes
└── RLS: paciente vê apenas seus efeitos; admin vê todos
```

### Regras de Negócio

#### Adesão Medicamentosa

A taxa de adesão é calculada como:

```
adesão = doses tomadas / (doses tomadas + doses perdidas + doses puladas) × 100
```

- **Doses pendentes** são automaticamente marcadas como **perdidas** quando passam do horário (com período de tolerância de 2 horas)
- A geração de doses diárias é automática: ao abrir o Dashboard, o sistema cria doses pendentes para todos os medicamentos ativos do dia
- A sequência de dias aderentes (streak) conta dias consecutivos em que todas as doses foram tomadas ou puladas (sem perdas)

#### Controle de Acesso (RBAC)

- **Perfil Patient**: acesso apenas aos próprios dados (RLS filtra por `created_by_id`)
- **Perfil Admin/Clinico**: acesso a todos os dados de todos os pacientes + painel de epidemiologia

### Persistência de Preferências

Todas as preferências do usuário são persistidas no banco de dados (entidade User), não em localStorage:

- **Idioma** — sincronizado com `user.language`
- **Tema** (claro/escuro) — sincronizado com `user.theme`
- **Preferências** (notificações, segurança/PIN, privacidade) — sincronizado com `user.preferences`

O localStorage é usado apenas como cache local para carregamento instantâneo da UI.

## 🌐 Internacionalização

O sistema suporta 7 idiomas com traduções completas:

| Código | Idioma | Bandeira |
|--------|--------|----------|
| `en` | English | 🇺🇸 |
| `pt` | Português | 🇧🇷 |
| `es` | Español | 🇪🇸 |
| `it` | Italiano | 🇮🇹 |
| `fr` | Français | 🇫🇷 |
| `ko` | 한국어 | 🇰🇷 |
| `ja` | 日本語 | 🇯🇵 |

As traduções cobrem toda a interface: navegação, formulários, mensagens, gráficos, conteúdo educativo e configurações.

## 🔒 Segurança e Privacidade

- **Row-Level Security** em todas as entidades — pacientes nunca acessam dados de outros pacientes
- **PIN de bloqueio** — opção de bloqueio do app com PIN de 4 dígitos (armazenado no DB)
- **Exportação de dados** — LGPD/GDPR compliant: o usuário pode exportar todos os seus dados em JSON
- **Exclusão de dados** — o usuário pode excluir permanentemente todos os seus dados
- **Coleta de dados** — opção de desativar coleta (com aviso de funcionalidade limitada)
- **Sem afirmações diagnósticas** — o sistema é de apoio, não substitui consulta médica

## 📱 Funcionalidades por Perfil

### Paciente

- Dashboard com resumo diário (adesão, streak, medicamentos do dia, crises recentes, sono)
- Gerenciamento de medicamentos (CRUD completo)
- Registro de doses (tomar/pular)
- Acompanhamento de adesão (gráficos de 7/30/90 dias, breakdown por medicamento)
- Registro de crises (CRUD com tipo, duração, gravidade, gatilhos)
- Registro de sono (CRUD com gráfico de 7 noites)
- Registro de efeitos colaterais (CRUD com vínculo a medicamento)
- Configurações (tema, idioma, notificações, segurança, privacidade)
- Exportar/excluir todos os dados

### Admin/Clinico

- Tudo do paciente + acesso a todos os pacientes
- Painel de epidemiologia:
  - Total de pacientes
  - Crises no mês corrente
  - Adesão média de todos os pacientes
  - Total de medicamentos ativos
- Lista de pacientes com adesão, crises e medicamentos
- Detalhe do paciente (medicamentos, crises recentes, sono médio)

## 🚀 Como Executar

### Pré-requisitos

1. Clone o repositório
2. Instale as dependências: `npm install`
3. Instale a Base44 CLI: `npm install -g base44@latest`
4. Instale [Deno](https://docs.deno.com/runtime/getting_started/installation/)

### Execução Local

```bash
base44 login   # uma vez por máquina
base44 link     # uma vez por clone
base44 dev      # backend + frontend juntos
```

Abra a URL exibida (tipicamente `http://localhost:5173`).

### Apenas Frontend (com backend remoto)

```bash
base44 dev --remote
```

## 📄 Licença

Projeto acadêmico — Centro Universitário Unifacvest.

© 2026 NERVA — Academic Research