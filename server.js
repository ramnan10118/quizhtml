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
let teamScores = new Map(); // Track team scores
const teamSockets = new Map(); // Track team name -> socket ID

// Quiz Questions
const questions = [
    {
        id: 1,
        text: "What is the capital of France?",
        options: ["London", "Berlin", "Paris", "Madrid"],
        correctAnswer: "Paris"
    },
    {
        id: 2,
        text: "Which planet is known as the Red Planet?",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        correctAnswer: "Mars"
    },
    {
        id: 3,
        text: "Who painted the Mona Lisa?",
        options: ["Van Gogh", "Da Vinci", "Picasso", "Rembrandt"],
        correctAnswer: "Da Vinci"
    },
    {
        id: 4,
        text: "What is the largest mammal in the world?",
        options: ["African Elephant", "Blue Whale", "Giraffe", "Polar Bear"],
        correctAnswer: "Blue Whale"
    },
    {
        id: 5,
        text: "Which element has the chemical symbol 'Au'?",
        options: ["Silver", "Copper", "Gold", "Aluminum"],
        correctAnswer: "Gold"
    }
];

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send current question number to newly connected participants
    socket.on('request-question-number', () => {
        console.log('Client requested question number:', socket.id);
        socket.emit('question-change', { 
            questionNumber: currentQuestion,
            questionData: questions[currentQuestion - 1]
        });
    });

    socket.on('register-team', (data) => {
        console.log('Team registered:', data.teamName);
        // Store socket ID with team name for future reference
        socket.teamName = data.teamName;
        teamSockets.set(data.teamName, socket.id);  // Store socket mapping
        
        // Initialize team score
        teamScores.set(data.teamName, 0);
        console.log('Team scores after registration:', Array.from(teamScores.entries()));
        // Notify host of new team
        io.emit('register-team', {
            socketId: socket.id,
            teamName: data.teamName,
            score: 0
        });
    });

    // Add new event for adding points
    socket.on('add-point', (data) => {
        console.log('\n=== Add Point Event ===');
        console.log('Request received for team:', data.teamName);
        console.log('Current teamScores Map:', Array.from(teamScores.entries()));
        console.log('Has team in scores:', teamScores.has(data.teamName));
        
        if (teamScores.has(data.teamName)) {
            const currentScore = teamScores.get(data.teamName);
            const newScore = currentScore + 1;
            teamScores.set(data.teamName, newScore);
            
            console.log(`Score updated: ${data.teamName} (${currentScore} → ${newScore})`);
            
            // Broadcast updated score to all clients
            io.emit('score-update', {
                teamName: data.teamName,
                score: newScore
            });
        } else {
            console.log('ERROR: Team not found in scores map');
            // Initialize score if missing
            teamScores.set(data.teamName, 1);
            io.emit('score-update', {
                teamName: data.teamName,
                score: 1
            });
        }
        console.log('=== End Add Point ===\n');
    });

    // Modify buzz event to include current score
    socket.on('buzz', (data) => {
        // Only allow buzz if not already in list
        if (!buzzOrder.some(buzz => buzz.socketId === socket.id)) {
            const buzzData = {
                socketId: socket.id,
                teamName: data.teamName,
                timestamp: data.timestamp,
                rank: buzzOrder.length + 1,
                score: teamScores.get(data.teamName) || 0
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
        console.log('Question change received from host');
        currentQuestion = data.questionNumber;
        buzzOrder = [];
        
        // Broadcast to ALL clients with question data
        io.emit('question-change', { 
            questionNumber: currentQuestion,
            questionData: questions[currentQuestion - 1],
            timestamp: Date.now()
        });
        
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

    socket.on('trigger-celebration', (data) => {
        console.log('\n=== Celebration Trigger ===');
        console.log('Celebration requested for team:', data.teamName);
        const socketId = teamSockets.get(data.teamName);
        console.log('Found socket ID:', socketId);
        
        if (socketId) {
            console.log('Sending celebration to socket:', socketId);
            io.to(socketId).emit('celebrate');
        } else {
            console.log('No socket found for team:', data.teamName);
        }
        console.log('=== End Celebration Trigger ===\n');
    });
});

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 