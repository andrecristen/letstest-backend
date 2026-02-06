const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });

const doc = {
  info: {
    title: 'Letstest API',
    description: 'Documentacao gerada automaticamente a partir das rotas Express.',
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const outputFile = './src/swagger/swagger-output.json';
const endpointsFiles = [
  './src/index.ts',
];

swaggerAutogen(outputFile, endpointsFiles, doc);
