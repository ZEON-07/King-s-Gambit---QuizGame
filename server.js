const express = require('express');
const http = require('http');
const { setupSocketManager } = require('./socketManager');
const host = '0.0.0.0';
const app = express();
const server = http.createServer(app);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
app.get('/admin.html', (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});
app.get('/preview.html', (req, res) => {
    res.sendFile(__dirname + '/preview.html');
});
app.get('/quiz.html', (req, res) => {
    res.sendFile(__dirname + '/quiz.html');
});

app.get('/leaderboard.html', (req, res) => {
    res.sendFile(__dirname + '/leaderboard.html');
});


app.get('/js/:file', (req, res) => {
    const file = req.params.file;
    if (['admin.js', 'leaderboard.js', 'login.js', 'modals.js', 'participant.js', 'preview.js', 'comminique.js'].includes(file)) {
        res.sendFile(__dirname + '/js/' + file);
    }
    else {
        res.status(404).send('Not found');
    }
}); 

app.get('/css/:file', (req, res) => {
    const file = req.params.file;
    if (['styles.css','admin.css','global.css','leaderboard.css','login.css','participant.css','preview.css'].includes(file)) {
        res.sendFile(__dirname + '/css/' + file);
    }   
    else {
        res.status(404).send('Not found');
    }
});



setupSocketManager(server);

server.listen(3000, host, () => {
    console.log('Server running on http://' + host + ':3000');
});


