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

    socket.on('buzz', (data) => {
        if (buzzerActive) {
            const teamName = teams.get(socket.id) || 'Unknown Team';
            
            // Add to buzz order if not already in
            if (!currentBuzzOrder.includes(socket.id)) {
                currentBuzzOrder.push(socket.id);
                const rank = currentBuzzOrder.length; // Get position in buzz order
                
                // Broadcast to all clients with rank information
                io.emit('buzz', {
                    socketId: socket.id,
                    teamName: teamName,
                    timestamp: data.timestamp,
                    rank: rank // Make sure this is included in the emit
                });
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
});

const PORT = 3001;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 