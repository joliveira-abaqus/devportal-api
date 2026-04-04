import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  console.info(`devportal-api rodando na porta ${PORT}`);
  console.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
