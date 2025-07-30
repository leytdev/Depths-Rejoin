import { BalanceModel } from "../schema/BalanceSchema";
import { TransactionModel } from "../schema/TransactionSchema";
import { BankModel, ensureBank } from "../schema/BankSchema";
import mongoose from "mongoose";


(async function initBank() {
  try {
    await ensureBank();

  } catch (err) {

  }
})();


export const BANK_ID = "server-bank";
export const SYSTEM_ID = "system";


export const TRANSACTION_TYPES = {
  AWARD: "award",
  DAILY: "daily_reward",
  COINFLIP_WIN: "coinflip_win",
  COINFLIP_LOSE: "coinflip_lose",
  BLACKJACK_WIN: "blackjack_win",
  BLACKJACK_LOSE: "blackjack_lose",
  BLACKJACK_DRAW: "blackjack_draw",
  BANK_TO_USER: "bank_to_user",
  USER_TO_BANK: "user_to_bank",
  USER_TRANSFER: "user_transfer",
  COMMISSION: "commission",
  SYSTEM: "system"
};

// Человекочитаемые названия для типов транзакций
export const TRANSACTION_NAMES: { [key: string]: string } = {
  // Основные типы
  "award": "Награда",
  "daily_reward": "Ежедневная награда",
  "coinflip_win": "Выигрыш в коинфлип",
  "coinflip_lose": "Проигрыш в коинфлип",
  "blackjack_win": "Выигрыш в блэкджек",
  "blackjack_lose": "Проигрыш в блэкджек",
  "blackjack_draw": "Ничья в блэкджек",
  "bank_to_user": "Зачисление из банка",
  "user_to_bank": "Перевод в банк",
  "user_transfer": "Перевод денежных средств",
  "commission": "Комиссия за перевод",
  "system": "Системная операция",

  // Типы транзакций для кланов
  "clan_create": "Создание клана",
  "clan_rename": "Изменение имени клана",
  "clan_deposit": "Пополнение казны клана",
  "clan_withdraw": "Вывод из казны клана",
  "clan_upgrade": "Улучшение клана"
};
export async function ensureBalanceEntry(UID: string) {
  let entry = await BalanceModel.findOne({ UID });
  if (!entry) {
    entry = new BalanceModel({ UID });
    await entry.save();
  }
  return entry;
}

/**
 * 
 * @param UID 
 * @param amount 
 * @param type 
 * @param sourceId 
 */
export async function addBalance(
  UID: string,
  amount: number,
  type: string = TRANSACTION_TYPES.SYSTEM,
  sourceId: string = SYSTEM_ID
) {
  try {

    const entry = await BalanceModel.findOneAndUpdate(
      { UID },
      { $inc: { balance: amount } },
      { new: true, upsert: true }
    );


    if (amount < 0 && sourceId !== BANK_ID) {
      await BankModel.findOneAndUpdate(
        { bankId: BANK_ID },
        {
          $inc: { balance: Math.abs(amount), totalTransactions: 1 },
          $set: { lastUpdated: new Date() }
        },
        { new: true, upsert: true }
      );


      await logTransaction(
        UID,
        BANK_ID,
        Math.abs(amount),
        "coins",
        type
      );
    }

    else if (amount > 0 && sourceId === BANK_ID) {
      await BankModel.findOneAndUpdate(
        { bankId: BANK_ID },
        {
          $inc: { balance: -amount, totalTransactions: 1 },
          $set: { lastUpdated: new Date() }
        },
        { new: true, upsert: true }
      );


      await logTransaction(
        BANK_ID,
        UID,
        amount,
        "coins",
        type
      );
    }

    else if (sourceId !== UID && sourceId !== BANK_ID) {
      await logTransaction(
        sourceId,
        UID,
        Math.abs(amount),
        "coins",
        type
      );
    }

    return entry.balance;
  } catch (error) {

    try {
      const entry = await BalanceModel.findOneAndUpdate(
        { UID },
        { $inc: { balance: amount } },
        { new: true, upsert: true }
      );

      return entry.balance;
    } catch (fallbackError) {
      throw fallbackError;
    }
  }
}


export async function addShards(
  UID: string,
  amount: number,
  type: string = TRANSACTION_TYPES.SYSTEM,
  sourceId: string = SYSTEM_ID
) {
  try {

    const entry = await BalanceModel.findOneAndUpdate(
      { UID },
      { $inc: { DepthsShards: amount } },
      { new: true, upsert: true }
    );

    if (amount < 0 && sourceId !== BANK_ID) {
      await BankModel.findOneAndUpdate(
        { bankId: BANK_ID },
        {
          $inc: { shards: Math.abs(amount), totalTransactions: 1 },
          $set: { lastUpdated: new Date() }
        },
        { new: true, upsert: true }
      );

      await logTransaction(
        UID,
        BANK_ID,
        Math.abs(amount),
        "shards",
        type
      );
    }

    else if (amount > 0 && sourceId === BANK_ID) {
      await BankModel.findOneAndUpdate(
        { bankId: BANK_ID },
        {
          $inc: { shards: -amount, totalTransactions: 1 },
          $set: { lastUpdated: new Date() }
        },
        { new: true, upsert: true }
      );


      await logTransaction(
        BANK_ID,
        UID,
        amount,
        "shards",
        type
      );
    }

    else if (sourceId !== UID) {
      await logTransaction(
        sourceId,
        UID,
        Math.abs(amount),
        "shards",
        type
      );
    }

    return entry.DepthsShards;
  } catch (error) {
    throw error;
  }
}


/**
 * Получить человекочитаемое название типа транзакции
 * @param type Технический код типа транзакции
 * @returns Человекочитаемое название
 */
export function getTransactionName(type: string): string {
  return TRANSACTION_NAMES[type] || type;
}

export async function logTransaction(
  senderUID: string,
  receiverUID: string,
  amount: number,
  currency: "coins" | "shards",
  type: string,
  session?: mongoose.ClientSession
) {
  try {
    const transaction = new TransactionModel({
      senderUID,
      receiverUID,
      amount,
      currency,
      type,
      timestamp: new Date()
    });

    // Если session не указан, сохраняем без неё
    if (session) {
      await transaction.save({ session });
    } else {
      await transaction.save();
    }

    return transaction;
  } catch (error) {
    // Продолжаем выполнение, даже если логирование не удалось
    // чтобы не блокировать игровой процесс
    return null;
  }
}

/**
 * Gets the bank status and balance
 */
export async function getBankStatus() {
  await ensureBank();
  return BankModel.findOne({ bankId: BANK_ID });
}

/**
 * Transfer money from the bank to a user
 */
export async function transferFromBank(
  userID: string,
  amount: number,
  currency: "coins" | "shards",
  type: string = TRANSACTION_TYPES.BANK_TO_USER
) {
  const bank = await ensureBank();

  // Check if bank has sufficient funds
  if (currency === "coins" && bank.balance < amount) {
    throw new Error("У банка недостаточно монет");
  }

  if (currency === "shards" && bank.shards < amount) {
    throw new Error("У банка недостаточно шардов");
  }

  // Transfer the funds
  if (currency === "coins") {
    return addBalance(userID, amount, type, BANK_ID);
  } else {
    return addShards(userID, amount, type, BANK_ID);
  }
}

/**
 * Get user transaction history
 */
export async function getUserTransactionHistory(userID: string, limit: number = 10) {
  return TransactionModel.find({
    $or: [
      { senderUID: userID },
      { receiverUID: userID }
    ],
    // Исключаем транзакции с типом commission из отображения для пользователей
    type: { $ne: TRANSACTION_TYPES.COMMISSION }
  })
    .sort({ timestamp: -1 })
    .limit(limit);
}

/**
 * Get bank transaction history
 */
export async function getBankTransactionHistory(limit: number = 20) {
  return TransactionModel.find({
    $or: [
      { senderUID: BANK_ID },
      { receiverUID: BANK_ID }
    ]
  })
    .sort({ timestamp: -1 })
    .limit(limit);
}

/**
 * Get statistics on transaction types (for charts)
 */
export async function getTransactionStats(period: 'day' | 'week' | 'month' = 'week') {
  // Calculate the start date based on the period
  const startDate = new Date();
  if (period === 'day') {
    startDate.setDate(startDate.getDate() - 1);
  } else if (period === 'week') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === 'month') {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  // Get transactions in the period
  const transactions = await TransactionModel.find({
    timestamp: { $gte: startDate }
  });

  // Group by type
  const stats: {
    income: {
      total: number,
      byType: Record<string, number>
    },
    expense: {
      total: number,
      byType: Record<string, number>
    }
  } = {
    income: {
      total: 0,
      byType: {}
    },
    expense: {
      total: 0,
      byType: {}
    }
  };

  // Process transactions
  transactions.forEach(transaction => {
    // Bank income (money flowing into bank)
    if (transaction.receiverUID === BANK_ID) {
      stats.income.total += transaction.amount;
      stats.income.byType[transaction.type] = (stats.income.byType[transaction.type] || 0) + transaction.amount;
    }

    // Bank expense (money flowing out of bank)
    if (transaction.senderUID === BANK_ID) {
      stats.expense.total += transaction.amount;
      stats.expense.byType[transaction.type] = (stats.expense.byType[transaction.type] || 0) + transaction.amount;
    }
  });

  return stats;
}