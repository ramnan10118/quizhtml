const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static('./'));

let buzzerActive = true;
let currentBuzzOrder = []; // Track the order of buzzes
const teams = new Map(); // Store team names with socket IDs
const teamScores = new Map(); // Store overall team scores
const MAX_RESPONSES = 3; // Add this at the top with other constants

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    socket.on('register-team', (data) => {
        teams.set(socket.id, data.teamName);
        console.log(`Team "${data.teamName}" registered`);
        // Broadcast to hosts
        io.emit('register-team', {
            socketId: socket.id,
            teamName: data.teamName
        });
    });

    socket.on('buzz', (data, callback) => {
        console.log('Server received buzz from:', {
            teamName: teams.get(socket.id),
            socketId: socket.id,
            buzzerActive
        });
        
        // Add acknowledgment
        callback && callback({ received: true });
        
        if (buzzerActive) {
            const teamName = teams.get(socket.id) || 'Unknown Team';
            
            if (!currentBuzzOrder.includes(socket.id)) {
                currentBuzzOrder.push(socket.id);
                const rank = currentBuzzOrder.length;
                
                console.log('Processing buzz:', {
                    teamName,
                    rank,
                    currentBuzzOrder
                });
                
                io.emit('buzz', {
                    socketId: socket.id,
                    teamName: teamName,
                    timestamp: data.timestamp,
                    rank: rank,
                    totalResponses: currentBuzzOrder.length
                });

                // Only disable buzzer if we've reached max responses
                if (currentBuzzOrder.length >= MAX_RESPONSES) {
                    buzzerActive = false;
                }
            }
        }
    });

    socket.on('reset-buzzer', () => {
        buzzerActive = true;
        currentBuzzOrder = []; // Clear the buzz order
        io.emit('reset-buzzer');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected:', socket.id);
        // Remove from buzz order if present
        currentBuzzOrder = currentBuzzOrder.filter(id => id !== socket.id);
        
        if (teams.has(socket.id)) {
            const teamName = teams.get(socket.id);
            console.log(`Team "${teamName}" disconnected`);
            teams.delete(socket.id);
            io.emit('disconnect-team', socket.id);
        }
    });

    socket.on('test-ping', (data, callback) => {
        console.log('Received test ping from:', data.team);
        callback({ pong: true });
    });
});

const PORT = 3001;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 