const TelegramBot = require('node-telegram-bot-api');
const mysql = require('mysql2/promise');

const token = '7752711526:AAHixCkfu3waU8-HhLtGoIALJXcXh195BXw';
const bot = new TelegramBot(token, { polling: true });

const dbConfig = {
  host: '127.0.0.1', // Только IP/домен без порта
  port: 3307,         // Порт вынесен отдельно
  user: 'root',
  password: '',
  database: 'todolist',
};

// Функции для работы с БД
async function getTasks() {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SELECT id, text FROM items ORDER BY id');
    await conn.end();
    return rows;
}

async function addTask(text) {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute('INSERT INTO items (text) VALUES (?)', [text]);
    await conn.end();
}

async function deleteTask(id) {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute('DELETE FROM items WHERE id = ?', [id]);
    await conn.end();
}

async function updateTask(id, newText) {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute('UPDATE items SET text = ? WHERE id = ?', [newText, id]);
    await conn.end();
}

// Обработка команд
bot.onText(/\/start/, async (msg) => {
    bot.sendMessage(msg.chat.id, `Привет, ${msg.from.first_name}! Я бот для работы с твоим To-Do списком.\n\nКоманды:\n/add <текст> — добавить задачу\n/list — показать задачи\n/delete <id> — удалить задачу\n/edit <id> <новый текст> — изменить задачу`);
});

bot.onText(/\/add (.+)/, async (msg, match) => {
    const text = match[1];
    await addTask(text);
    bot.sendMessage(msg.chat.id, 'Задача добавлена!');
});

bot.onText(/\/list/, async (msg) => {
    const tasks = await getTasks();
    if (tasks.length === 0) {
        bot.sendMessage(msg.chat.id, 'Список задач пуст.');
        return;
    }

    const message = tasks.map(task => `${task.id}. ${task.text}`).join('\n');
    bot.sendMessage(msg.chat.id, `Твои задачи:\n\n${message}`);
});

bot.onText(/\/delete (\d+)/, async (msg, match) => {
    const id = parseInt(match[1]);
    await deleteTask(id);
    bot.sendMessage(msg.chat.id, `Задача с id ${id} удалена.`);
});

bot.onText(/\/edit (\d+) (.+)/, async (msg, match) => {
    const id = parseInt(match[1]);
    const newText = match[2];
    await updateTask(id, newText);
    bot.sendMessage(msg.chat.id, `Задача с id ${id} обновлена.`);
});

bot.onText(/\/help/, async (msg) => {
    const helpText = `
🛠 *Доступные команды:*

➕ /add _текст задачи_ — добавить новую задачу  
📋 /list — показать все задачи  
🗑️ /delete _id_ — удалить задачу по её номеру  
✏️ /edit _id новый текст_ — изменить текст задачи  
📖 /help — показать эту справку
`;

    bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

bot.setMyCommands([
    { command: '/add', description: 'Добавить задачу (/add текст)' },
    { command: '/list', description: 'Показать список задач' },
    { command: '/delete', description: 'Удалить задачу по ID' },
    { command: '/edit', description: 'Редактировать задачу (/edit id текст)' },
    { command: '/help', description: 'Справка по командам' }
]);