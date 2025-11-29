// Função para encerrar o bot de forma limpa

function encerrarBot() {
  console.log(`${motivo}`);

  // Limpa todos os timer ativos
  for (const [usuarioId, intervalo] of usuariosEmVoz) {
    clearInterval(intervalo);
    usuariosEmVoz.delete(userId);
  }

  // Destrói a conexão do bot com o discord
  client.destroy();

  console.log("Bot encerrado com segurança");
  process.exit(0);
}

// Captura encerramentos manuais  (Ctrl + C)
process.on("SIGINT", () => encerrarBot("SBot interrommpido manualmente"));

// Captura comandos do sistema (fechamento, logoff, etc)
process.on("SIGTERM", () => encerrarBot("Sistema falhou"));

process.on("uncaughtException", (err) => {
  console.error("Erro não tratado", err);
  encerrarBot("Errno inesperado");
});

// Captura rejeições de promises não tratadas
process.on("unhandledRejection", (reason, Promise) => {
  console.error("Rejeição de Promise  não tratada:", reason);
});

module.exports = { encerrarBot };
