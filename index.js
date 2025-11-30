require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const TOKEN = process.env.TOKEN_BOT;
const { farmXp } = require("./commands/farmXp");
const { encerrarBot } = require("./utils/encerrarBot");
const JSONdb = require("simple-json-db");
const db = new JSONdb("./database/database.json");

// Coloque aqui o ID do canal que quer que o bot envie mensagens
const CANAL_TEXTO_ID = process.env.CANAL_TEXTO_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers, // necessário para membros em voz
  ],
});

// ✅ Bot online
client.once("ClientReady", () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
});

// 💬 Comandos de texto
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = "!";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const comando = args.shift().toLowerCase();

  if (comando === "xp") return mostrarXp(message);
  if (comando === "rank") return mostrarRank(message);
});

// Função para mostrar XP do usuário
async function mostrarXp(message) {
  const usuarioId = message.author.id;

  // Buscar usuário no banco
  let usuario = await db.get(`usuario_${usuarioId}`);

  // Se não existir, criar com valores iniciais
  if (!usuario) {
    usuario = {
      xp: 0,
      level: 1,
      titulo: null,
    };
  }

  // Atualizar XP (exemplo: 20 XP por mensagem de texto)
  usuario.xp = (usuario.xp || 0) + 0.5;

  // Calcular level (pode ajustar fórmula)
  let xpProximoNivel = 100 * usuario.level ** 2;
  while (usuario.xp >= xpProximoNivel) {
    usuario.level += 1;
    usuario.xp -= xpProximoNivel;
    xpProximoNivel = 100 * usuario.level ** 2;
  }

  // Salvar no banco
  await db.set(`usuario_${usuarioId}`, usuario);

  const progressoPercent = Math.min(
    Math.floor((usuario.xp / xpProximoNivel) * 100),
    100
  );
  let progresso = Math.floor((usuario.xp / xpProximoNivel) * 10);
  progresso = Math.max(0, Math.min(progresso, 10));
  const barra = "🟩".repeat(progresso) + "⬜".repeat(10 - progresso);

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("📊 Seu Progresso")
    .setDescription("Veja seus status atuais abaixo:")
    .addFields(
      { name: "🧬 Nível", value: `${usuario.level}`, inline: true },
      {
        name: "⭐ XP",
        value: `${usuario.xp} / ${xpProximoNivel}`,
        inline: true,
      },
      {
        name: "🏅 Título",
        value: usuario.titulo || "Sem título ainda",
        inline: false,
      },
      {
        name: "📈 Progresso",
        value: `${barra} (${progressoPercent}%)`,
        inline: false,
      }
    )
    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: "Continue ativo para evoluir sua aura!" })
    .setTimestamp();

  message.channel.send({ embeds: [embed] });
}

// Função para mostrar ranking
async function mostrarRank(message) {
  const todos = db.JSON();
  const lista = Object.entries(todos)
    .filter(([chave]) => chave.startsWith("usuario_"))
    .map(([chave, dados]) => ({ id: chave.split("_")[1], ...dados }))
    .sort((a, b) => b.level - a.level || b.xp - a.xp);

  if (lista.length === 0)
    return message.reply("❌ Ninguém tem XP registrado ainda!");

  const top10 = lista.slice(0, 10);
  const medalhas = ["🥇", "🥈", "🥉"];
  let descricao = "";

  for (let i = 0; i < top10.length; i++) {
    const user = await message.client.users
      .fetch(top10[i].id)
      .catch(() => null);
    const nome = user?.username || `<@${top10[i].id}>`;
    const medalha = medalhas[i] || "🔹";
    descricao += `${medalha} **${nome}** — Nível **${top10[i].level}**, XP **${top10[i].xp}**\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle("🏆 Ranking dos Mais Evoluídos")
    .setDescription(descricao)
    .setColor("#F1C40F")
    .setFooter({ text: "Continue participando para subir no ranking!" })
    .setTimestamp();

  message.channel.send({ embeds: [embed] });
}

// 🎧 Sistema de XP em call
const usuariosEmVoz = new Map();

client.on("voiceStateUpdate", async (oldState, newState) => {
  const membro = newState.member;
  if (!membro || membro.user.bot) return;

  // Entrou em call
  if (!oldState.channel && newState.channel) {
    if (usuariosEmVoz.has(membro.id)) return;

    console.log(`${membro.user.username} entrou em ${newState.channel.name}`);

    const intervalo = setInterval(async () => {
      const fakeMessage = { author: membro.user, guild: newState.guild };
      const xpMin = 25;
      const xpMax = 30;
      const xpGanho = Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin;

      const resultado = await farmXp(membro.id, fakeMessage, xpGanho);
      if (!resultado) return;

      const { embed, infoTitulo } = resultado;

      // Canal fixo definido
      const canalTexto = newState.guild.channels.cache.get(CANAL_TEXTO_ID);
      if (!canalTexto) return;

      // Envia título se houver e não repetido
      if (
        infoTitulo &&
        (!membro.tituloAnterior || membro.tituloAnterior !== infoTitulo.titulo)
      ) {
        canalTexto.send(
          `🎉 **Parabéns, ${fakeMessage.author.username}!** Você conquistou o título **${infoTitulo.titulo}** ${infoTitulo.emoji}`
        );
        membro.tituloAnterior = infoTitulo.titulo;
      }

      // Envia embed de XP
      if (embed) canalTexto.send({ embeds: [embed] });

      console.log(`🎧 +${xpGanho} XP para ${membro.user.username}`);
    }, 30 * 60 * 1000); // 30 minutos

    usuariosEmVoz.set(membro.id, intervalo);
  }

  // Saiu da call
  if (oldState.channel && !newState.channel) {
    console.log(`${membro.user.username} saiu de ${oldState.channel.name}`);
    const intervalo = usuariosEmVoz.get(membro.id);
    if (intervalo) {
      clearInterval(intervalo);
      usuariosEmVoz.delete(membro.id);
    }
  }
});

client.login(TOKEN);

// Encerramentos seguros
process.on("SIGINT", () => encerrarBot("Bot interrompido manualmente"));
process.on("SIGTERM", () => encerrarBot("Sistema encerrado"));
process.on("uncaughtException", (err) => {
  console.error("Erro não tratado", err);
  encerrarBot("Erro inesperado");
});
process.on("unhandledRejection", (reason) => {
  console.error("Rejeição de Promise não tratada:", reason);
});
