import { PrismaClient } from "@prisma/client";
import { crypt } from "../src/utils/crypt.server";

const prisma = new PrismaClient();

const ApprovalStatus = {
  Draft: 1,
  Reviewed: 2,
  Approved: 3,
};

const ProjectVisibility = {
  Public: 1,
  Private: 2,
};

const ProjectSituation = {
  Testing: 1,
};

const InvolvementSituation = {
  Applied: 1,
  Invited: 2,
  Rejected: 3,
  Accepted: 4,
};

const InvolvementType = {
  Tester: 1,
  Manager: 2,
};

const EnvironmentSituation = {
  Operative: 1,
};

const TemplateType = {
  DefinitionTestCase: 1,
  ExecutionTestCase: 2,
  ExecutionTestScenario: 3,
};

const TagSituation = {
  Use: 1,
  DontUse: 2,
};

const ReportType = {
  Approved: 1,
  Rejected: 2,
};

const DeviceType = {
  Smartphone: 1,
  Notebook: 2,
  Desktop: 3,
  Tablet: 4,
};

const HabilityType = {
  Experience: 1,
  Certification: 2,
  Course: 3,
  Language: 4,
  SoftSkill: 5,
};

const makeRow = (id: number, columns: any[], minColumnCount = 1, maxColumnCount = 6) => ({
  id,
  minColumnCount,
  maxColumnCount,
  columns,
});

const makeColumn = (id: number, type: string, content: any, extra: Record<string, any> = {}) => ({
  id,
  type,
  content,
  ...extra,
});

const buildTableData = (rows: any[]) =>
  rows.reduce<Record<string, any>>((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});

const now = new Date();
const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

async function resetDatabase() {
  await prisma.notificationRecipient.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.testExecution.deleteMany();
  await prisma.testCaseAssignment.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.testScenario.deleteMany();
  await prisma.environment.deleteMany();
  await prisma.tagValue.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.template.deleteMany();
  await prisma.involvement.deleteMany();
  await prisma.device.deleteMany();
  await prisma.hability.deleteMany();
  await prisma.notificationSettings.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.file.deleteMany();
}

declare const process: {
  env: Record<string, string | undefined>;
  exit: (code?: number) => void;
};

async function main() {
  const shouldReset = process.env.SEED_RESET === "1" || process.env.SEED_RESET === "true";
  if (shouldReset) {
    await resetDatabase();
  }

  const passwordHash = await crypt.encrypt("123456");
  if (!passwordHash) {
    throw new Error("Failed to hash default password.");
  }

  const owner = await prisma.user.create({
    data: {
      name: "Andre Cristen",
      email: "andre@letstest.com",
      password: passwordHash,
      access: 1,
      bio: "Owner e gerente do projeto principal.",
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: "Marina Alves",
      email: "marina@letstest.com",
      password: passwordHash,
      access: 1,
      bio: "Gerente QA com foco em automacao.",
    },
  });

  const tester = await prisma.user.create({
    data: {
      name: "Lucas Silva",
      email: "lucas@letstest.com",
      password: passwordHash,
      access: 1,
      bio: "Testador funcional e exploratorio.",
    },
  });

  const tester2 = await prisma.user.create({
    data: {
      name: "Paula Souza",
      email: "paula@letstest.com",
      password: passwordHash,
      access: 1,
      bio: "Testadora mobile e performance.",
    },
  });

  await prisma.hability.createMany({
    data: [
      { userId: manager.id, type: HabilityType.Experience, value: "6 anos QA" },
      { userId: manager.id, type: HabilityType.Certification, value: "ISTQB CTFL" },
      { userId: tester.id, type: HabilityType.Language, value: "Ingles intermediario" },
      { userId: tester2.id, type: HabilityType.Course, value: "Cypress avancado" },
      { userId: tester2.id, type: HabilityType.SoftSkill, value: "Comunicacao clara" },
    ],
  });

  const devicePhone = await prisma.device.create({
    data: {
      userId: tester.id,
      type: DeviceType.Smartphone,
      brand: "Apple",
      model: "iPhone 14",
      system: "iOS 17",
    },
  });

  await prisma.device.createMany({
    data: [
      {
        userId: tester2.id,
        type: DeviceType.Notebook,
        brand: "Dell",
        model: "XPS 13",
        system: "Windows 11",
      },
      {
        userId: manager.id,
        type: DeviceType.Desktop,
        brand: "Custom",
        model: "Ryzen 7",
        system: "Ubuntu 22.04",
      },
    ],
  });

  const projectMain = await prisma.project.create({
    data: {
      name: "Plataforma Letstest",
      description: "Projeto principal com fluxo completo de QA.",
      visibility: ProjectVisibility.Private,
      situation: ProjectSituation.Testing,
      creatorId: owner.id,
      approvalEnabled: true,
      approvalScenarioEnabled: true,
      approvalTestCaseEnabled: true,
      dueDate: daysFromNow(30),
    },
  });

  const projectPublic = await prisma.project.create({
    data: {
      name: "Landing Publica",
      description: "Projeto aberto para testar onboarding.",
      visibility: ProjectVisibility.Public,
      situation: ProjectSituation.Testing,
      creatorId: owner.id,
      approvalEnabled: false,
      approvalScenarioEnabled: false,
      approvalTestCaseEnabled: false,
    },
  });

  await prisma.notificationSettings.createMany({
    data: [
      { projectId: projectMain.id, enableDeadlineWarning: true, deadlineWarningDays: 7 },
      { projectId: projectPublic.id, enableDeadlineWarning: true, deadlineWarningDays: 3 },
    ],
  });

  await prisma.involvement.createMany({
    data: [
      {
        projectId: projectMain.id,
        userId: manager.id,
        type: InvolvementType.Manager,
        situation: InvolvementSituation.Accepted,
      },
      {
        projectId: projectMain.id,
        userId: tester.id,
        type: InvolvementType.Tester,
        situation: InvolvementSituation.Accepted,
      },
      {
        projectId: projectMain.id,
        userId: tester2.id,
        type: InvolvementType.Tester,
        situation: InvolvementSituation.Invited,
      },
      {
        projectId: projectPublic.id,
        userId: tester2.id,
        type: InvolvementType.Tester,
        situation: InvolvementSituation.Applied,
      },
    ],
  });

  const envStaging = await prisma.environment.create({
    data: {
      projectId: projectMain.id,
      name: "Staging",
      description: "Ambiente com dados anonimizados.",
      situation: EnvironmentSituation.Operative,
    },
  });

  const envProd = await prisma.environment.create({
    data: {
      projectId: projectMain.id,
      name: "Producao",
      description: "Ambiente produtivo de referencia.",
      situation: EnvironmentSituation.Operative,
    },
  });

  const priorityTag = await prisma.tag.create({
    data: {
      projectId: projectMain.id,
      name: "Prioridade",
      situation: TagSituation.Use,
      commentary: "Nivel de prioridade do caso.",
    },
  });

  const priorityHigh = await prisma.tagValue.create({
    data: {
      projectId: projectMain.id,
      tagId: priorityTag.id,
      name: "Alta",
      situation: TagSituation.Use,
      commentary: "Critico para release.",
    },
  });

  const priorityMedium = await prisma.tagValue.create({
    data: {
      projectId: projectMain.id,
      tagId: priorityTag.id,
      name: "Media",
      situation: TagSituation.Use,
      commentary: "Importante, mas nao bloqueia release.",
    },
  });

  const scenarioTemplateRows = [
    makeRow(1001, [
      makeColumn(1101, "Label", "Objetivo"),
      makeColumn(1102, "Texto Longo", "", { placeholder: "Descreva o objetivo do cenario" }),
    ]),
    makeRow(1002, [
      makeColumn(1201, "Label", "Pre-condicoes"),
      makeColumn(1202, "Texto Longo", "", { placeholder: "Pre-requisitos para executar o cenario" }),
    ]),
  ];

  const caseTemplateRows = [
    makeRow(2001, [
      makeColumn(2101, "Label", "Entradas"),
      makeColumn(2102, "Texto", "", { placeholder: "Dados de entrada" }),
      makeColumn(2103, "Campo Personalizado", priorityMedium.id, { tagId: priorityTag.id }),
    ]),
    makeRow(2002, [
      makeColumn(2201, "Label", "Resultado esperado"),
      makeColumn(2202, "Texto Longo", "", { placeholder: "Resultado esperado da execucao" }),
    ]),
  ];

  await prisma.template.createMany({
    data: [
      {
        projectId: projectMain.id,
        name: "Definicao de Cenario",
        description: "Base para definir cenarios completos.",
        type: TemplateType.ExecutionTestScenario,
        data: buildTableData(scenarioTemplateRows),
      },
      {
        projectId: projectMain.id,
        name: "Definicao de Caso",
        description: "Modelo padrao de caso de teste.",
        type: TemplateType.DefinitionTestCase,
        data: buildTableData(caseTemplateRows),
      },
      {
        projectId: projectMain.id,
        name: "Execucao de Caso",
        description: "Checklist de execucao.",
        type: TemplateType.ExecutionTestCase,
        data: buildTableData([
          makeRow(3001, [
            makeColumn(3101, "Label", "Notas da execucao"),
            makeColumn(3102, "Texto Longo", "", { placeholder: "Observacoes" }),
          ]),
        ]),
      },
    ],
  });

  const scenarioApproved = await prisma.testScenario.create({
    data: {
      projectId: projectMain.id,
      name: "Login com sucesso",
      data: buildTableData([
        makeRow(4001, [
          makeColumn(4101, "Label", "Objetivo"),
          makeColumn(4102, "Texto Longo", "Validar login com credenciais validas."),
        ]),
        makeRow(4002, [
          makeColumn(4201, "Label", "Pre-condicoes"),
          makeColumn(4202, "Texto Longo", "Usuario ativo e sem bloqueios."),
        ]),
      ]),
      approvalStatus: ApprovalStatus.Approved,
      approvedAt: now,
      approvedById: manager.id,
    },
  });

  await prisma.testScenario.create({
    data: {
      projectId: projectMain.id,
      name: "Recuperacao de senha",
      data: buildTableData([
        makeRow(4011, [
          makeColumn(4111, "Label", "Objetivo"),
          makeColumn(4112, "Texto Longo", "Verificar envio de email para reset."),
        ]),
      ]),
      approvalStatus: ApprovalStatus.Draft,
      reviewedAt: now,
      reviewedById: manager.id,
    },
  });

  const scenarioApproved2 = await prisma.testScenario.create({
    data: {
      projectId: projectMain.id,
      name: "Cadastro com dados invalidos",
      data: buildTableData([
        makeRow(4021, [
          makeColumn(4121, "Label", "Objetivo"),
          makeColumn(4122, "Texto Longo", "Garantir validacoes no formulario de cadastro."),
        ]),
      ]),
      approvalStatus: ApprovalStatus.Approved,
      approvedAt: now,
      approvedById: manager.id,
    },
  });

  await prisma.testScenario.create({
    data: {
      projectId: projectMain.id,
      name: "Atualizacao de perfil",
      data: buildTableData([
        makeRow(4031, [
          makeColumn(4131, "Label", "Objetivo"),
          makeColumn(4132, "Texto Longo", "Validar atualizacao de dados do usuario."),
        ]),
      ]),
      approvalStatus: ApprovalStatus.Draft,
    },
  });

  const testCaseApproved = await prisma.testCase.create({
    data: {
      projectId: projectMain.id,
      testScenarioId: scenarioApproved.id,
      environmentId: envStaging.id,
      name: "CT-Login-001",
      data: buildTableData([
        makeRow(5001, [
          makeColumn(5101, "Label", "Entradas"),
          makeColumn(5102, "Texto", "usuario valido / senha valida"),
          makeColumn(5103, "Campo Personalizado", priorityHigh.id, { tagId: priorityTag.id }),
        ]),
        makeRow(5002, [
          makeColumn(5201, "Label", "Resultado esperado"),
          makeColumn(5202, "Texto Longo", "Login realizado e dashboard exibido."),
        ]),
      ]),
      approvalStatus: ApprovalStatus.Approved,
      approvedAt: now,
      approvedById: manager.id,
      dueDate: daysFromNow(5),
    },
  });

  const testCaseApproved2 = await prisma.testCase.create({
    data: {
      projectId: projectMain.id,
      testScenarioId: scenarioApproved2.id,
      environmentId: envProd.id,
      name: "CT-Reset-002",
      data: buildTableData([
        makeRow(5011, [
          makeColumn(5111, "Label", "Entradas"),
          makeColumn(5112, "Texto", "email valido"),
          makeColumn(5113, "Campo Personalizado", priorityMedium.id, { tagId: priorityTag.id }),
        ]),
        makeRow(5012, [
          makeColumn(5211, "Label", "Resultado esperado"),
          makeColumn(5212, "Texto Longo", "Email enviado com link de recuperacao."),
        ]),
      ]),
      approvalStatus: ApprovalStatus.Approved,
      approvedAt: now,
      approvedById: manager.id,
      dueDate: daysFromNow(10),
    },
  });

  const testCaseDraft = await prisma.testCase.create({
    data: {
      projectId: projectMain.id,
      testScenarioId: scenarioApproved.id,
      environmentId: envStaging.id,
      name: "CT-Login-002",
      data: buildTableData([
        makeRow(5021, [
          makeColumn(5121, "Label", "Entradas"),
          makeColumn(5122, "Texto", "usuario bloqueado"),
          makeColumn(5123, "Campo Personalizado", priorityMedium.id, { tagId: priorityTag.id }),
        ]),
        makeRow(5022, [
          makeColumn(5221, "Label", "Resultado esperado"),
          makeColumn(5222, "Texto Longo", "Mensagem de bloqueio exibida."),
        ]),
      ]),
      approvalStatus: ApprovalStatus.Approved,
      approvedAt: now,
      approvedById: manager.id,
    },
  });

  const assignmentFinished = await prisma.testCaseAssignment.create({
    data: {
      testCaseId: testCaseApproved.id,
      userId: tester.id,
      assignedById: manager.id,
      assignedAt: daysFromNow(-3),
      startedAt: daysFromNow(-2),
      totalPausedSeconds: 900,
      finishedAt: daysFromNow(-1),
    },
  });

  await prisma.testCaseAssignment.create({
    data: {
      testCaseId: testCaseApproved2.id,
      userId: tester2.id,
      assignedById: manager.id,
      assignedAt: daysFromNow(-2),
      startedAt: daysFromNow(-1),
      lastPausedAt: minutesAgo(45),
      totalPausedSeconds: 600,
    },
  });

  await prisma.testCaseAssignment.create({
    data: {
      testCaseId: testCaseDraft.id,
      userId: tester.id,
      assignedById: manager.id,
      assignedAt: daysFromNow(-1),
    },
  });

  const testExecution = await prisma.testExecution.create({
    data: {
      testCaseId: testCaseApproved.id,
      userId: tester.id,
      deviceId: devicePhone.id,
      reported: assignmentFinished.finishedAt ?? now,
      testTime: 1800,
      data: buildTableData([
        makeRow(6001, [
          makeColumn(6101, "Label", "Notas da execucao"),
          makeColumn(6102, "Texto Longo", "Fluxo OK, sem erros aparentes."),
        ]),
      ]),
    },
  });

  await prisma.report.createMany({
    data: [
      {
        testExecutionId: testExecution.id,
        userId: tester.id,
        type: ReportType.Approved,
        score: 5,
        commentary: "Tudo funcionando conforme esperado.",
      },
      {
        testExecutionId: testExecution.id,
        userId: manager.id,
        type: ReportType.Rejected,
        score: 2,
        commentary: "Identificado atraso no carregamento.",
      },
    ],
  });

  await prisma.project.create({
    data: {
      name: "Projeto Mobile",
      description: "Aplicativo para testes de regressao mobile.",
      visibility: ProjectVisibility.Private,
      situation: ProjectSituation.Testing,
      creatorId: manager.id,
      approvalEnabled: true,
      approvalScenarioEnabled: false,
      approvalTestCaseEnabled: true,
    },
  });

  console.log("Seed concluido com sucesso.");
}

const run = async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

run();
