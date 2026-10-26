module.exports = {
  transforms: [
    {
      mode: 'sql',
      include: 'acled/**/*.sql',
      emitTemplate: '{{dir}}/{{name}}.queries.ts',
    },
    {
      mode: 'ts',
      include: 'acled/**/*.ts',
      emitTemplate: '{{dir}}/{{name}}.types.ts',
    },
  ],
  srcDir: '.',
  failOnError: false,
  camelCaseColumnNames: false,
  dbUrl: process.env.POSTGRES_CONNECTION_STRING,
};
