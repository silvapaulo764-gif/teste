const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Pasta pública para servir arquivos de upload e o HTML do site
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Garante que a pasta uploads exista
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do Multer (Armazenamento de Arquivos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Gera um nome único para o arquivo evitando substituição
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'midia-' + uniqueSuffix + ext);
  }
});

// Filtro de tipos de arquivo (apenas vídeo e imagens permitidos)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['video/mp4', 'image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato inválido! Envie apenas arquivos MP4, JPG ou PNG.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // Limite de 100MB por arquivo
});

// Inicialização e Criação do Banco de Dados SQLite
const db = new sqlite3.Database('./banco_anuncios.db', (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS anuncios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      empresa TEXT NOT NULL,
      email TEXT NOT NULL,
      telefone TEXT NOT NULL,
      plano TEXT NOT NULL,
      nome_arquivo TEXT NOT NULL,
      caminho_arquivo TEXT NOT NULL,
      data_envio DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// --- ROTAS DA APLICAÇÃO ---

// Rota de Envio de Anúncios (POST)
app.post('/api/anuncios', upload.single('arquivo_midia'), (req, res) => {
  try {
    const { nome, empresa, email, telefone, plano } = req.body;

    if (!req.file) {
      return res.status(400).json({ status: 'erro', mensagem: 'Por favor, anexe um arquivo de mídia.' });
    }

    const nomeArquivo = req.file.filename;
    const caminhoArquivo = `/uploads/${req.file.filename}`;

    const query = `
      INSERT INTO anuncios (nome, empresa, email, telefone, plano, nome_arquivo, caminho_arquivo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [nome, empresa, email, telefone, plano, nomeArquivo, caminhoArquivo], function (err) {
      if (err) {
        console.error('Erro ao salvar no banco:', err.message);
        return res.status(500).json({ status: 'erro', mensagem: 'Erro interno ao salvar os dados.' });
      }

      res.status(201).json({
        status: 'sucesso',
        mensagem: 'Anúncio e mídia recebidos e armazenados com sucesso!',
        idAnuncio: this.lastID
      });
    });
  } catch (error) {
    res.status(500).json({ status: 'erro', mensagem: error.message });
  }
});

// Rota do Painel Admin (Lista todos os anúncios e arquivos cadastrados)
app.get('/api/anuncios', (req, res) => {
  db.all(`SELECT * FROM anuncios ORDER BY data_envio DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ status: 'erro', mensagem: err.message });
    }
    res.json({ status: 'sucesso', dados: rows });
  });
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}`);
});