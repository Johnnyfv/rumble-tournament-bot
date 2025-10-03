// Rumble Tournament Bot for Cloudflare Workers with CCPayment Integration (Revised v1)
// - Cloudflare Worker single file
// - KV: TOURNAMENTS, USER_WALLETS (wrangler.toml bindings)
// - Env: TELEGRAM_BOT_TOKEN, CCPAYMENT_APP_ID, CCPAYMENT_APP_SECRET

const TELEGRAM_API = "https://api.telegram.org/bot"; // + token + /method
const CCPAYMENT_API = "https://admin.ccpayment.com/ccpayment/v1";

// Battle actions - funny and silly scenarios
const BATTLE_ACTIONS = [
  "{winner} throws a grand piano at {loser}",
  "{winner} summons a flock of angry geese against {loser}",
  "{winner} launches {loser} into orbit with a catapult",
  "{winner} drops a refrigerator on {loser}",
  "{winner} hits {loser} with a folding chair WWE style",
  "{winner} unleashes a swarm of bees on {loser}",
  "{winner} throws a birthday cake at {loser}",
  "{winner} bonks {loser} with a giant squeaky hammer",
  "{winner} pushes {loser} into a pool of jello",
  "{winner} drops a safe on {loser} like a cartoon",
  "{winner} pelts {loser} with water balloons filled with mayo",
  "{winner} summons a tornado that yeets {loser}",
  "{winner} launches {loser} with a giant slingshot",
  "{winner} drops an anvil on {loser}",
  "{winner} hits {loser} with a fish",
  "{winner} throws a washing machine at {loser}",
  "{winner} summons a giant rubber duck to crush {loser}",
  "{winner} launches bowling balls at {loser}",
  "{winner} drops a Mazda on {loser}",
  "{winner} throws a vending machine at {loser}",
  "{winner} summons an army of squirrels to attack {loser}",
  "{winner} hits {loser} with a stop sign",
  "{winner} launches {loser} into a wall with a rocket",
  "{winner} drops a boat on {loser}",
  "{winner} throws a mailbox at {loser}",
  "{winner} summons a giant beach ball that knocks out {loser}",
  "{winner} drops a couch on {loser} from the roof",
  "{winner} hits {loser} with a traffic cone",
  "{winner} launches fireworks at {loser}",
  "{winner} throws a tire at {loser}",
  "{winner} summons a UFO that abducts and drops {loser}",
  "{winner} pelts {loser} with frozen turkeys",
  "{winner} drops a chandelier on {loser}",
  "{winner} throws a parking meter at {loser}",
  "{winner} launches {loser} with a trebuchet",
  "{winner} drops a drum kit on {loser}",
  "{winner} hits {loser} with a shopping cart full of bricks",
  "{winner} summons a stampede of chickens that tramples {loser}",
  "{winner} throws a pinball machine at {loser}",
  "{winner} drops a porta-potty on {loser}",
  "{winner} launches garden gnomes at {loser}",
  "{winner} throws a grill at {loser}",
  "{winner} summons a giant magnet that slams {loser} into a wall",
  "{winner} drops a statue on {loser}",
  "{winner} hits {loser} with a canoe",
  "{winner} launches confetti cannons that blast {loser} away",
  "{winner} throws a motorcycle at {loser}",
  "{winner} summons a wrecking ball that demolishes {loser}",
  "{winner} drops a bookshelf on {loser}",
  "{winner} hits {loser} with a surfboard",
  "{winner} launches {loser} off a cliff with a rocket-powered skateboard",
  "{winner} throws a treadmill at {loser}",
  "{winner} summons a tidal wave that washes away {loser}",
  "{winner} drops a toilet on {loser}",
  "{winner} hits {loser} with a ladder",
  "{winner} launches pumpkins from a cannon at {loser}",
  "{winner} throws a barbecue grill at {loser}",
  "{winner} summons lightning that strikes {loser}",
  "{winner} drops a bus on {loser}",
  "{winner} hits {loser} with a kayak"
];

const ELIMINATION_ACTIONS = [
  "{loser} is eliminated!",
  "{loser} is knocked out of the tournament!",
  "{loser} has been defeated!",
  "{loser} is out!",
  "{loser} falls and can’t get up!",
  "{loser} has left the arena!",
  "{loser} is done for!",
  "{loser} waves the white flag!"
];

// Token IDs for supported coins (defaults assume TRC20 where possible)
const TOKEN_IDS = {
  USDC_TRC20: "fdf0e8b0-ebf5-44f0-a335-21c121b73fc8",
  USDC_ERC20: "8e5741cf-6e51-4892-9d04-3d40e1dd0128",
  USDT_TRC20: "9b7ef527-7f96-4e2d-aa6d-c6380e55747d"
  // Add more as needed
};

export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      const update = await request.json();
      try {
        await handleUpdate(update, env);
      } catch (e) {
        console.error("Update error", e);
      }
      return new Response("OK");
    }
    return new Response("Rumble Bot Running");
  }
};

async function handleUpdate(update, env) {
  if (!update.message && !update.callback_query) return;

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, env);
    return;
  }

  const message = update.message;
  const chatId = message.chat.id;
  const text = (message.text || "").trim();
  const userId = message.from.id;
  const username = message.from.username || message.from.first_name || String(userId);

  // Commands
  if (text.startsWith("/rumble")) {
    await handleRumbleCommand(chatId, userId, username, text, env);
  } else if (text === "/join") {
    await handleJoinCommand(chatId, userId, username, env);
  } else if (text === "/start_tournament") {
    await handleStartTournament(chatId, userId, env);
  } else if (text === "/cancel") {
    await handleCancelTournament(chatId, userId, env);
  } else if (text.startsWith("/setcwallet")) {
    await handleSetCWallet(chatId, userId, text, env);
  }
}

async function handleSetCWallet(chatId, userId, text, env) {
  // /setcwallet [cwallet_id or email]
  const parts = text.split(" ");
  if (parts.length < 2) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN,
      "❌ Usage: /setcwallet [your_cwallet_id or email]\nExample: /setcwallet myusername or /setcwallet user@email.com");
    return;
  }
  const cwalletId = parts.slice(1).join(" ").trim();
  if (!cwalletId) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, "❌ Please provide a valid CWallet ID or email");
    return;
  }
  await env.USER_WALLETS.put(`wallet_${userId}`, cwalletId);
  await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN,
    `✅ Your CWallet ID has been set to: ${cwalletId}\n\nYou can now receive tournament prizes!`);
}

async function handleRumbleCommand(chatId, userId, username, text, env) {
  // /rumble [amount] [currency]
  const parts = text.split(/\s+/);
  if (parts.length < 3) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN,
      "❌ Usage: /rumble [amount] [currency]\nExample: /rumble 20 usdc");
    return;
  }

  const amount = Number(parts[1]);
  const currency = String(parts[2] || "").toUpperCase();

  if (!Number.isFinite(amount) || amount <= 0) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, "❌ Invalid amount");
    return;
  }

  const tokenId = getTokenId(currency);
  if (!tokenId) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN,
      `❌ Currency ${currency} not supported yet.\nSupported: USDC, USDT`);
    return;
  }

  // Prevent overlapping tournaments in the same chat
  const existing = await env.TOURNAMENTS.get(`tournament_${chatId}`);
  if (existing) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN,
      "❌ A tournament is already active in this chat. Use /cancel to clear it.");
    return;
  }

  const tournament = {
    chatId,
    hostId: userId,
    hostUsername: username,
    amount,
    currency,
    tokenId,
    status: "pending_payment",
    participants: [],
    createdAt: Date.now()
  };

  await env.TOURNAMENTS.put(`tournament_${chatId}`, JSON.stringify(tournament));

  const keyboard = {
    inline_keyboard: [
      [{ text: "✅ I have deposited funds", callback_data: `confirm_deposit_${chatId}` }],
      [{ text: "❌ Cancel", callback_data: `cancel_${chatId}` }]
    ]
  };

  await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN,
    `🎮 Rumble Tournament Setup\n\n` +
    `Host: @${username}\n` +
    `Prize Pool: ${amount} ${currency}\n\n` +
    `📱 IMPORTANT: Deposit the prize money first.\n` +
    `1) Open your CCPayment merchant account\n` +
    `2) Deposit ${amount} ${currency} to your merchant wallet\n` +
    `3) Tap \"I have deposited funds\" below`,
    { reply_markup: keyboard }
  );
}

async function handleCallbackQuery(query, env) {
  const chatId = query.message?.chat?.id;
  const userId = query.from?.id;
  const data = query.data || "";

  try {
    if (!chatId || !userId) return;

    if (data.startsWith("confirm_deposit_")) {
      await handleDepositConfirmation(chatId, userId, env);
    } else if (data.startsWith("cancel_")) {
      await handleCancelTournament(chatId, userId, env);
    } else if (data.startsWith("distribution_")) {
      await handleDistributionChoice(chatId, userId, data, env);
    }
  } finally {
    // Always answer to clear loading state
    await fetch(`${TELEGRAM_API}${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: query.id })
    }).catch(() => {});
  }
}

async function handleDepositConfirmation(chatId, userId, env) {
  const tData = await env.TOURNAMENTS.get(`tournament_${chatId}`);
  if (!tData) return;
  const tournament = JSON.parse(tData);

  if (tournament.hostId !== userId) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, "❌ Only the host can confirm deposit");
    return;
  }

  // TODO (prod): verify merchant wallet balance / deposit via CCPayment webhook or API.
  tournament.status = "waiting_for_distribution";
  await env.TOURNAMENTS.put(`tournament_${chatId}`, JSON.stringify(tournament));

  const keyboard = {
    inline_keyboard: [
      [{ text: "🏆 Winner Take All", callback_data: `distribution_winner_${chatId}` }],
      [{ text: "🥇🥈🥉 Top 3 (60/30/10)", callback_data: `distribution_top3_${chatId}` }],
      [{ text: "👥 Everyone (50% + split)", callback_data: `distribution_everyone_${chatId}` }]
    ]
  };

  await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, "✅ Deposit confirmed!\n\nChoose prize distribution:", { reply_markup: keyboard });
}

async function handleDistributionChoice(chatId, userId, data, env) {
  const tData = await env.TOURNAMENTS.get(`tournament_${chatId}`);
  if (!tData) return;
  const tournament = JSON.parse(tData);

  if (tournament.hostId !== userId) return;

  const distribution = data.split("_")[1];
  tournament.distribution = distribution;
  tournament.status = "registration";
  await env.TOURNAMENTS.put(`tournament_${chatId}`, JSON.stringify(tournament));

  await sendMessage(
    chatId,
    env.TELEGRAM_BOT_TOKEN,
    `🎮 RUMBLE TOURNAMENT OPEN!\n\n` +
      `Prize Pool: ${tournament.amount} ${tournament.currency}\n` +
      `Distribution: ${getDistributionText(distribution)}\n` +
      `Minimum Players: 4\n\n` +
      `⚠️ PLAYERS: Set your CWallet first!\n` +
      `Use: /setcwallet [your_cwallet_id or email]\n\n` +
      `Then type /join to enter!\n` +
      `Host will type /start_tournament when ready.`
  );
}

async function handleJoinCommand(chatId, userId, username, env) {
  const tData = await env.TOURNAMENTS.get(`tournament_${chatId}`);
  if (!tData) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, "❌ No active tournament");
    return;
  }
  const tournament = JSON.parse(tData);

  if (tournament.status !== "registration") {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, "❌ Tournament is not accepting registrations");
    return;
  }

  const cwalletId = await env.USER_WALLETS.get(`wallet_${userId}`);
  if (!cwalletId) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, `❌ @${username}, set your CWallet first!\nUse: /setcwallet [your_cwallet_id or email]`);
    return;
  }

  if (tournament.participants.some((p) => p.userId === userId)) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, "❌ You already joined!");
    return;
  }

  tournament.participants.push({ userId, username, cwalletId });
  await env.TOURNAMENTS.put(`tournament_${chatId}`, JSON.stringify(tournament));

  await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, `✅ @${username} joined! (${tournament.participants.length} players)`);
}

async function handleStartTournament(chatId, userId, env) {
  const tData = await env.TOURNAMENTS.get(`tournament_${chatId}`);
  if (!tData) return;
  const tournament = JSON.parse(tData);

  if (tournament.hostId !== userId) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, "❌ Only the host can start the tournament");
    return;
  }

  if (tournament.status !== "registration") {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, "❌ Tournament is not in registration state");
    return;
  }

  if (tournament.participants.length < 4) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, `❌ Need at least 4 players. Currently: ${tournament.participants.length}`);
    return;
  }

  let participants = [...tournament.participants];

  // If odd, remove host if present; else run a playoff to reduce to even
  if (participants.length % 2 !== 0) {
    const hostIndex = participants.findIndex((p) => p.userId === tournament.hostId);
    if (hostIndex !== -1) {
      participants.splice(hostIndex, 1);
      await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, "⚠️ Odd number of players — host has been dropped from the bracket");
    } else {
      const playoff = await runPlayoffRound(participants);
      await sendMessage(
        chatId,
        env.TELEGRAM_BOT_TOKEN,
        `⚔️ PLAYOFF ROUND\n\n${playoff.battleText}\n\n${playoff.winner.username} advances!`
      );
      participants = participants.filter((p) => p.userId !== playoff.loser.userId);
    }
  }

  tournament.status = "in_progress";
  tournament.participants = participants;
  tournament.allParticipants = [...participants];
  tournament.currentRound = 1;
  await env.TOURNAMENTS.put(`tournament_${chatId}`, JSON.stringify(tournament));

  await runTournament(chatId, tournament, env);
}

async function runPlayoffRound(participants) {
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  const [p1, p2] = [shuffled[0], shuffled[1]];
  const winner = Math.random() < 0.5 ? p1 : p2;
  const loser = winner === p1 ? p2 : p1;
  const battleText = generateBattle(winner.username, loser.username);
  return { winner, loser, battleText };
}

async function runTournament(chatId, tournament, env) {
  let participants = [...tournament.participants];
  let round = 1;
  const allParticipants = [...tournament.allParticipants];
  const placements = []; // losers stack first; winner last

  while (participants.length > 1) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, `\n🔥 ROUND ${round} 🔥\n${participants.length} fighters remain!`);
    await sleep(1200);

    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const pairs = [];
    for (let i = 0; i < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);

    const roundWinners = [];
    const roundLosers = [];

    for (const [p1, p2] of pairs) {
      const winner = Math.random() < 0.5 ? p1 : p2;
      const loser = winner === p1 ? p2 : p1;
      const battleText = generateBattle(winner.username, loser.username);
      await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, `⚔️ ${p1.username} vs ${p2.username}\n\n${battleText}`);
      roundWinners.push(winner);
      roundLosers.push(loser);
      await sleep(1000);
    }

    // Add losers to placements (reverse finishing order across rounds)
    placements.unshift(...roundLosers);

    // Rare resurrection before final
    if (roundWinners.length === 2 && Math.random() < 0.05) {
      const eliminated = participants.filter((p) => !roundWinners.some((w) => w.userId === p.userId));
      const resurrectionCount = getResurrectionCount(allParticipants.length);
      if (eliminated.length >= resurrectionCount) {
        const resurrected = [...eliminated].sort(() => Math.random() - 0.5).slice(0, resurrectionCount);
        roundWinners.push(...resurrected);
        // Remove resurrected from placements
        for (const r of resurrected) {
          const idx = placements.findIndex((p) => p.userId === r.userId);
          if (idx !== -1) placements.splice(idx, 1);
        }
        await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, `⚡️ RESURRECTION! ⚡️\n\n${resurrected.map((p) => p.username).join(", ")} rise from the ashes!`);
        await sleep(800);
      }
    }

    participants = roundWinners;
    round++;
  }

  // Winner is last remaining
  placements.push(participants[0]);

  await distributePrizes(chatId, tournament, placements.reverse(), env);
}

function generateBattle(winnerName, loserName) {
  const actionCount = Math.floor(Math.random() * 4) + 2; // 2–5 actions
  const actions = [];
  for (let i = 0; i < actionCount - 1; i++) {
    const tmpl = BATTLE_ACTIONS[Math.floor(Math.random() * BATTLE_ACTIONS.length)];
    const attackerIsWinner = Math.random() < 0.5;
    const attacker = attackerIsWinner ? winnerName : loserName;
    const defender = attackerIsWinner ? loserName : winnerName;
    actions.push(tmpl.replace("{winner}", attacker).replace("{loser}", defender));
  }
  const finalTmpl = BATTLE_ACTIONS[Math.floor(Math.random() * BATTLE_ACTIONS.length)];
  actions.push(finalTmpl.replace("{winner}", winnerName).replace("{loser}", loserName));
  const elimination = ELIMINATION_ACTIONS[Math.floor(Math.random() * ELIMINATION_ACTIONS.length)];
  actions.push(elimination.replace("{loser}", loserName));
  return actions.join("\n");
}

function getResurrectionCount(totalPlayers) {
  if (totalPlayers <= 6) return 1;
  if (totalPlayers <= 10) return 2;
  return 3;
}

async function distributePrizes(chatId, tournament, placements, env) {
  const winner = placements[0];
  await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN,
    `🏆 TOURNAMENT COMPLETE! 🏆\n\n👑 Winner: @${winner.username}\n\nDistributing prizes...`);
  await sleep(1000);

  const prizes = calculatePrizes(tournament.amount, tournament.distribution, placements.length);
  const fee = tournament.amount * 0.05; // 5% fee
  const totalPayout = tournament.amount - fee;

  let successCount = 0;
  for (let i = 0; i < prizes.length && i < placements.length; i++) {
    const player = placements[i];
    const amt = prizes[i] || 0;
    if (amt <= 0) continue;

    try {
      const ok = await sendPrize(player.cwalletId, amt, tournament.currency, tournament.tokenId, env);
      if (ok) {
        successCount++;
        await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, `💰 @${player.username} received ${amt.toFixed(2)} ${tournament.currency}!`);
      } else {
        await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, `⚠️ Failed to send prize to @${player.username}. Please contact the host.`);
      }
    } catch (err) {
      await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, `⚠️ Error sending prize to @${player.username}: ${err?.message || err}`);
    }

    await sleep(600);
  }

  await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN,
    `✅ Prize Distribution Complete!\n\n` +
    `Total Pool: ${tournament.amount} ${tournament.currency}\n` +
    `Bot Fee (5%): ${fee.toFixed(2)} ${tournament.currency}\n` +
    `Distributed: ${totalPayout.toFixed(2)} ${tournament.currency}\n\n` +
    `Thanks for playing! 🎮`);

  await env.TOURNAMENTS.delete(`tournament_${chatId}`);
}

function calculatePrizes(totalAmount, distribution, playerCount) {
  const fee = totalAmount * 0.05;
  const payout = totalAmount - fee;
  const prizes = [];

  if (distribution === "winner" || playerCount <= 1) {
    prizes.push(Math.max(payout, 0));
    return prizes;
  }

  if (distribution === "top3") {
    const top = [0.6, 0.3, 0.1];
    for (let i = 0; i < Math.min(3, playerCount); i++) prizes.push(payout * top[i]);
    return prizes;
  }

  if (distribution === "everyone") {
    const first = payout * 0.5;
    prizes.push(first);
    const remaining = payout - first;
    const denom = Math.max(playerCount - 1, 1);
    const per = remaining / denom;
    for (let i = 1; i < playerCount; i++) prizes.push(per);
    return prizes;
  }

  // Fallback: winner take all
  prizes.push(Math.max(payout, 0));
  return prizes;
}

async function sendPrize(cwalletId, amount, currency, tokenId, env) {
  // NOTE: Confirm CCPayment signature algorithm. This is a placeholder SHA-256 of concatenation.
  // Many providers require HMAC-SHA256(secret, body) or similar.
  const timestamp = Math.floor(Date.now() / 1000);
  const merchantOrderId = `rumble_${timestamp}_${Math.random().toString(36).slice(2, 11)}`;

  const body = {
    token_id: tokenId,
    address: cwalletId, // CWallet ID or email
    merchant_order_id: merchantOrderId,
    value: String(amount),
    merchant_pays_fee: true
  };

  const bodyString = JSON.stringify(body);
  const sign = await generateSignature(env.CCPAYMENT_APP_ID, env.CCPAYMENT_APP_SECRET, timestamp, bodyString);

  const res = await fetch(`${CCPAYMENT_API}/withdraw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Appid": env.CCPAYMENT_APP_ID,
      "Timestamp": String(timestamp),
      "Sign": sign
    },
    body: bodyString
  });

  let result;
  try { result = await res.json(); } catch { result = null; }

  if (result && result.code === 10000) return true;
  console.error("CCPayment error", result);
  return false;
}

async function generateSignature(appId, appSecret, timestamp, body) {
  // TODO: Replace with the exact CCPayment signing method (likely HMAC-SHA256 over body or canonical string)
  const data = appId + appSecret + String(timestamp) + body;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getTokenId(currency) {
  const key = `${currency}_TRC20`; // default TRC20
  return TOKEN_IDS[key] || null;
}

function getDistributionText(distribution) {
  switch (distribution) {
    case "winner": return "🏆 Winner Take All";
    case "top3": return "🥇🥈🥉 Top 3 (60/30/10)";
    case "everyone": return "👥 Everyone (50% + split)";
    default: return distribution;
  }
}

async function handleCancelTournament(chatId, userId, env) {
  const tData = await env.TOURNAMENTS.get(`tournament_${chatId}`);
  if (!tData) return;
  const tournament = JSON.parse(tData);

  if (tournament.hostId !== userId) {
    await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, "❌ Only the host can cancel");
    return;
  }

  await env.TOURNAMENTS.delete(`tournament_${chatId}`);
  await sendMessage(chatId, env.TELEGRAM_BOT_TOKEN, "❌ Tournament cancelled");
}

async function sendMessage(chatId, token, text, options = {}) {
  const payload = { chat_id: chatId, text, ...options };
  await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
