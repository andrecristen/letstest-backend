# Letstest Backend

Este repositório contém o código-fonte do projeto Letstest Backend, desenvolvido como parte do Trabalho de Conclusão de Curso (TCC) do curso de Engenharia de Software.

## Descrição

O Letstest é uma plataforma para gestão e execução de testes automatizados. O backend foi desenvolvido utilizando Node.js e Express.

## Tecnologias Utilizadas

- **Node.js**: Ambiente de execução JavaScript server-side.
- **Express**: Framework web para Node.js.
- **Jest**: Framework de testes para JavaScript.

## Demonstração

[Youtube](https://youtu.be/QxlsbTeRnuY)


## @todo

Tenho uma boa visão do projeto agora. Sugestões de funcionalidades que fazem sentido com o que vocês já têm:

Prioridade alta (impacto direto no uso diário)

Workflow de aprovação de casos/execuções (rascunho → revisado → aprovado).
Versão e histórico de alterações nos casos/planilhas (diff + rollback).
Comentários por célula/linha no CustomizableTable (audit trail).
Qualidade e governança

“Checklist de cobertura” por cenário/ambiente/dispositivo (ver lacunas).
SLA de execução (tempo alvo x real, alertas de atraso).
Permissões por função (gerente/testador/admin) com escopos por projeto.

Produtividade

Templates inteligentes (reutilizar campos, duplicar casos com variações).
Execução em lote (rodar vários casos de uma vez).
Import/export (CSV/Excel) com validação.

Relatórios

Dashboard de KPIs por projeto (pass/fail, tempo médio, taxa de defeito).
Relatório “executado por dispositivo/ambiente” com filtros rápidos.
Notificações (e‑mail/in-app) para eventos críticos.

Integrações

Webhook / API pública para integração com CI/CD.
Integração com Jira/GitHub Issues (abrir bug direto do resultado).
Se você quiser, escolhemos 1–2 e detalho o fluxo completo + telas e modelo de dados. Qual dessas te parece mais urgente?