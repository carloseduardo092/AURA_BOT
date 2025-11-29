const { EmbedBuilder } = require("discord.js");
const JSONdb = require("simple-json-db");
const db = new JSONdb("./database/database.json");

// 🧱 Função principal de farm de XP
async function farmXp(usuarioId, message, xpGanho) {
  let usuario = db.get(`usuario_${usuarioId}`);

  // Cria registro se não existir
  if (!usuario) {
    usuario = { xp: 0, level: 1, titulo: null };
    db.set(`usuario_${usuarioId}`, usuario);
  }

  // Atualiza XP e level
  usuario.xp += xpGanho;
  let { xp, level } = usuario;

  while (xp >= 100 * level ** 2) {
    xp -= 100 * level ** 2;
    level++;
  }

  usuario.xp = xp;
  usuario.level = level;
  db.set(`usuario_${usuarioId}`, usuario);

  // 🎖️ Sistema de títulos
  const titulos = {
    5: { titulo: "Aprendiz", cor: "#57F287", emoji: "📝" },
    10: { titulo: "Guerreiro", cor: "#5865F2", emoji: "⚔️" },
    15: { titulo: "Mestre", cor: "#F1C40F", emoji: "🏆" },
    20: { titulo: "Herói", cor: "#E91E63", emoji: "🌟" },
    25: { titulo: "Lendário", cor: "#9B59B6", emoji: "🔥" },
    35: { titulo: "Farmardor de Aura", cor: "#FF4500", emoji: "⚡" },
    50: { titulo: "Aura Elevada", cor: "#4B0082", emoji: "💫" },
  };

  const niveis = Object.keys(titulos)
    .map(Number)
    .sort((a, b) => a - b);
  const nivelTitulo = niveis.filter((n) => level >= n).pop();
  const infoTitulo = titulos[nivelTitulo];

  // ⚙️ Gerencia cargos se houver guild
  if (infoTitulo && message.guild) {
    try {
      const guild = message.guild;
      const membro = await guild.members.fetch(usuarioId).catch(() => null);

      if (membro) {
        const cargoNome = infoTitulo.titulo;

        // Verifica se cargo existe, senão cria
        let cargo = guild.roles.cache.find((r) => r.name === cargoNome);
        if (!cargo) {
          cargo = await guild.roles.create({
            name: cargoNome,
            color: infoTitulo.cor, // já atualizado para Discord.js v14
            reason: "Cargo automático por título",
          });
          console.log(`✅ Cargo criado: ${cargoNome}`);
        }

        // Remove títulos antigos
        const titulosAntigos = Object.values(titulos)
          .map((t) => t.titulo)
          .filter((t) => t !== cargoNome);

        for (const nomeAntigo of titulosAntigos) {
          const cargoAntigo = guild.roles.cache.find(
            (r) => r.name === nomeAntigo
          );
          if (cargoAntigo && membro.roles.cache.has(cargoAntigo.id)) {
            await membro.roles.remove(cargoAntigo).catch(() => {});
          }
        }

        // Adiciona novo cargo
        if (!membro.roles.cache.has(cargo.id)) {
          await membro.roles.add(cargo);
          console.log(`${membro.user.username} recebeu o cargo ${cargoNome}`);
        }
      }
    } catch (err) {
      console.log("❌ Erro ao gerenciar cargos:", err);
    }

    usuario.titulo = infoTitulo.titulo;
    db.set(`usuario_${usuarioId}`, usuario);

    // Embed de congratulação
    const embed = new EmbedBuilder()
      .setTitle(`${infoTitulo.emoji} Parabéns!`)
      .setDescription(
        `Você subiu para o nível **${level}** e conquistou o título **${infoTitulo.titulo}**!`
      )
      .setColor(infoTitulo.cor)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: "Continue evoluindo e conquistando títulos!" })
      .addFields(
        { name: "Nível Atual", value: `${level}`, inline: true },
        { name: "XP Atual", value: `${xp}`, inline: true },
        {
          name: "Título Conquistado",
          value: `${infoTitulo.titulo}`,
          inline: false,
        }
      );

    return { embed, infoTitulo };
  }

  return { embed: null, infoTitulo: null };
}

module.exports = { farmXp };
