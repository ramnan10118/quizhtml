const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

// Game state
let buzzOrder = [];
let currentQuestion = 1;
const MAX_RESPONSES = 3;

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send current question number to newly connected participants
    socket.on('request-question-number', () => {
        socket.emit('question-change', { questionNumber: currentQuestion });
    });

    socket.on('register-team', (data) => {
        console.log('Team registered:', data.teamName);
        // Store socket ID with team name for future reference
        socket.teamName = data.teamName;
        // Notify host of new team
        io.emit('register-team', {
            socketId: socket.id,
            teamName: data.teamName
        });
    });

    socket.on('buzz', (data) => {
        // Only allow buzz if not already in list
        if (!buzzOrder.some(buzz => buzz.socketId === socket.id)) {
            const buzzData = {
                socketId: socket.id,
                teamName: data.teamName,
                timestamp: data.timestamp,
                rank: buzzOrder.length + 1
            };
            
            buzzOrder.push(buzzData);
            
            // Emit to all clients with total responses
            io.emit('buzz', {
                ...buzzData,
                totalResponses: buzzOrder.length
            });
        }
    });

    socket.on('question-change', (data) => {
        console.log('Server received question change:', data);
        currentQuestion = data.questionNumber;
        // Reset buzz order when question changes
        buzzOrder = [];
        // Notify all clients of question change
        console.log('Server broadcasting question change to all clients');
        io.emit('question-change', { 
            questionNumber: currentQuestion,
            timestamp: Date.now()
        });
        // Also emit reset-buzzer to ensure all clients reset their state
        io.emit('reset-buzzer');
    });

    socket.on('reset-buzzer', () => {
        buzzOrder = [];
        io.emit('reset-buzzer');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Notify host if a team disconnects
        io.emit('disconnect-team', socket.id);
    });

    // Test ping handler
    socket.on('test-ping', (data, callback) => {
        if (callback) {
            callback({ status: 'ok', message: 'Pong!' });
        }
    });
});

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 