# 🚀 Crypto Crash Game

A real-time, multiplayer "Crash" game backend built with Node.js, Express, MongoDB, and Socket.IO. This project simulates a crypto-based betting experience where players must cash out before the multiplier crashes.

## ✨ Features

-   **Real-Time Gameplay**: A multiplier increases exponentially, with updates broadcast to all clients every 100ms using WebSockets.
-   **Live Betting System**: Players bet in USD, which is converted on-the-fly to BTC or ETH using real-time prices.
-   **Multiplayer Experience**: See other players' cash-out events as they happen.
-   **Provably Fair**: The crash point for each round is determined by a cryptographically secure and verifiable algorithm.
-   **Wallet & Transaction Simulation**: The system manages player balances and logs all bets and payouts.
-   **Robust & Scalable**: Features a distinct betting phase and running phase to prevent race conditions and ensure a stable experience.

## 🛠️ Tech Stack

-   **Backend**: Node.js, Express.js
-   **Database**: MongoDB with Mongoose
-   **Real-Time Communication**: Socket.IO
-   **External APIs**: CoinGecko API for live cryptocurrency prices

## 🏁 Getting Started

Follow these instructions to get the project running on your local machine.

### **Prerequisites**

-   [Node.js](https://nodejs.org/en/) (v18 or higher)
-   [MongoDB](https://www.mongodb.com/try/download/community) (a local instance or a free cloud cluster on MongoDB Atlas)
-   [Git](https://git-scm.com/)

### **Setup Instructions**

1.  **Clone the Repository**
    ```bash
    git clone <your-repository-url>
    cd crypto-crash-game
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Set Up Environment Variables**
    Create a file named `.env` in the root directory and add your MongoDB connection string:
    ```
    MONGO_URI=your_mongodb_atlas_connection_string
    ```

4.  **Seed the Database (Optional but Recommended)**
    To populate the database with a few sample players for testing:
    ```bash
    npm run seed:import
    ```
    This will create 3 players and you can copy their IDs from your MongoDB Atlas dashboard.

5.  **Start the Server**
    ```bash
    npm start
    ```
    The server will be running at `http://localhost:3000`.

## 📡 API Endpoints

All API endpoints are prefixed with `/api`.

### Players

-   **Create a Player**
    -   `POST /players`
    -   **Body**:
        ```json
        {
          "name": "NewPlayer123"
        }
        ```
    -   **Response**: `201 Created` with the full player object, including the new `_id`.

-   **Get Player Balance**
    -   `GET /players/:id/balance`
    -   **URL Params**: `:id` (Player's MongoDB `_id`)
    -   **Response**: `200 OK` with the player's wallet object.

### Game Actions

-   **Place a Bet**
    -   `POST /bet`
    -   This endpoint is only available during the "betting phase" of a round.
    -   **Body**:
        ```json
        {
          "playerId": "your_player_id",
          "amountUsd": 10,
          "currency": "BTC"
        }
        ```
    -   **Response**: `200 OK` with a success message and the updated wallet balance.

## 🔌 WebSocket Events

The primary game interaction happens over WebSockets.

### Server-to-Client Events

-   `betting_phase_start`
    -   Announces that the betting window is open for a new round.
    -   **Payload**: `{ "round_id": number, "duration": number }`

-   `round_start`
    -   Announces that the multiplier has started increasing and betting is closed.
    -   **Payload**: `{ "round_id": number, "seed_hash": "string" }`

-   `multiplier_update`
    -   Sent every 100ms with the current game multiplier.
    -   **Payload**: `{ "multiplier": "string" }` (e.g., "1.25")

-   `round_crash`
    -   Announces that the round has ended.
    -   **Payload**: `{ "crash_point": "string" }`

-   `player_cashed_out`
    -   Broadcast to all clients when a player successfully cashes out.
    -   **Payload**: `{ "username": "string", "cashoutMultiplier": number, "payoutUsd": "string" }`

-   `cashout_success` / `cashout_error`
    -   Sent *only* to the player who attempted to cash out to confirm the result.

### Client-to-Server Events

-   `cashout`
    -   Sent by a player to attempt a cash out during a running round.
    -   **Payload**: `{ "playerId": "string" }`

## 🎲 Core Concepts

### Provably Fair Algorithm

To ensure transparency and fairness, the crash point of each round is determined before the round starts using a cryptographic algorithm.
1.  A secret **Server Seed** is generated for each round.
2.  The server combines this seed with the public **Round Number**.
3.  This combination is hashed using **HMAC-SHA256**.
4.  The resulting hash uniquely and deterministically generates the crash point.

At the start of the round, the **hash** is revealed to the players. At the end of the round, the **Server Seed** is revealed. Players can use these values to independently recalculate the crash point and verify that the result was not manipulated.

### USD-to-Crypto Conversion

Real-time cryptocurrency prices are used for all financial calculations.
-   The backend calls the **CoinGecko API** to fetch the current price of BTC and ETH in USD.
-   To avoid hitting API rate limits, prices are **cached for 10 seconds**.
-   When a player bets $10, the backend uses the latest price to calculate the equivalent crypto amount (e.g., `$10 / $65,000 per BTC`). This crypto amount is what's actually wagered.
-   On cash out, the crypto winnings are converted back to USD at the current price for display.
