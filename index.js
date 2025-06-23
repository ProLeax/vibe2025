const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');
const cookie = require('cookie');

const PORT = 3000;
const dbConfig = {
  host: '127.0.0.1', // Только IP/домен без порта
  port: 3307,         // Порт вынесен отдельно
  user: 'root',
  password: '',
  database: 'todolist',
};

async function query(sql, params=[]) {
  const conn = await mysql.createConnection(dbConfig);
  const [rows] = await conn.execute(sql, params);
  await conn.end();
  return rows;
}

function parseCookies(req) {
  return cookie.parse(req.headers.cookie || '');
}

async function handleRequest(req, res) {
  try {
    // Serve home page
    if (req.method==='GET' && req.url==='/') {
      let html = await fs.readFile(path.join(__dirname,'index.html'),'utf8');
      // if logged in, inject rows; else leave placeholder
      const cookies = parseCookies(req);
      if (cookies.userId) {
        const items = await query('SELECT id, text FROM items WHERE user_id=? ORDER BY id', [cookies.userId]);
        const rows = items.map(it=>`
          <tr>
            <td>${it.id}</td>
            <td>${it.text}</td>
            <td>
              <button onclick="editItem(${it.id}, '${it.text.replace(/'/g,"\\'")}')">Edit</button>
              <button onclick="deleteItem(${it.id})">Delete</button>
            </td>
          </tr>`).join('');
        html = html.replace('{{rows}}', rows);
      }
      res.writeHead(200,{'Content-Type':'text/html'}).end(html);
    }

    // Registration
    else if (req.method==='POST' && req.url==='/register') {
      let body=''; req.on('data',c=>body+=c); req.on('end', async()=>{
        const {username,password} = JSON.parse(body);
        await query('INSERT INTO users(username,password) VALUES(?,?)',[username,password]);
        res.writeHead(200).end();
      });
    }

    // Login
    else if (req.method==='POST' && req.url==='/login') {
      let body=''; req.on('data',c=>body+=c); req.on('end', async()=>{
        const {username,password} = JSON.parse(body);
        const rows = await query('SELECT id FROM users WHERE username=? AND password=?',[username,password]);
        if (rows.length===1) {
          res.writeHead(200, {
            'Set-Cookie': cookie.serialize('userId',String(rows[0].id),{httpOnly:true})
          }).end();
        } else {
          res.writeHead(401).end();
        }
      });
    }

    // Logout is client-side: cookie cleared in browser

    // Get items
    else if (req.method==='GET' && req.url==='/items') {
      const cookies = parseCookies(req);
      if (!cookies.userId) return res.writeHead(401).end();
      const items = await query('SELECT id, text FROM items WHERE user_id=? ORDER BY id',[cookies.userId]);
      res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(items));
    }

    // Add item
    else if (req.method==='POST' && req.url==='/items') {
      const cookies = parseCookies(req);
      if (!cookies.userId) return res.writeHead(401).end();
      let body=''; req.on('data',c=>body+=c); req.on('end', async()=>{
        const {text} = JSON.parse(body);
        await query('INSERT INTO items(text,user_id) VALUES(?,?)',[text,cookies.userId]);
        res.writeHead(200).end();
      });
    }

    // Update item
    else if (req.method==='PUT' && req.url.startsWith('/items/')) {
      const cookies = parseCookies(req);
      if (!cookies.userId) return res.writeHead(401).end();
      const id = req.url.split('/')[2];
      let body=''; req.on('data',c=>body+=c); req.on('end', async()=>{
        const {text} = JSON.parse(body);
        await query('UPDATE items SET text=? WHERE id=? AND user_id=?',[text,id,cookies.userId]);
        res.writeHead(200).end();
      });
    }

    // Delete item
    else if (req.method==='DELETE' && req.url.startsWith('/items/')) {
      const cookies = parseCookies(req);
      if (!cookies.userId) return res.writeHead(401).end();
      const id = req.url.split('/')[2];
      await query('DELETE FROM items WHERE id=? AND user_id=?',[id,cookies.userId]);
      res.writeHead(200).end();
    }

    // 404
    else {
      res.writeHead(404).end('Not Found');
    }
  } catch (e) {
    console.error(e);
    res.writeHead(500).end('Server Error');
  }
}

http.createServer(handleRequest).listen(PORT, ()=>console.log(`Server at ${PORT}`));
