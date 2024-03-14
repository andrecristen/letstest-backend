### Executar projeto: 

```
npx tsc                               
node dist/index.js
```

### Criar migration: 

```
npx prisma migrate dev
```

### Aplicar migration: 

```
npx prisma db pull
```

### Gerar Prisma Client:

```
npx prisma generate
```

### Exemplo .env:

```
DATABASE_URL="postgresql://andrecristen:130217@localhost:5432/letstest?schema=public"
PORT=3000
```