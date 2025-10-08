
## 📖 Overview

Sol-Drive is a decentralized file storage platform that lets users upload, store, and retrieve files securely.  
Files are split into chunks, stored on IPFS, and indexed on the Solana blockchain, ensuring transparency and permanence.

## ⚙️ Features

- 🔗 Upload files through a web interface  
- 🧩 Split files into chunks for distributed storage  
- 🪶 Store chunk metadata & ownership on Solana  
- ⬇️ Retrieve and reassemble files using on-chain metadata  
- 👛 Wallet integration (Phantom, Solflare, etc.)

## 🏗 Architecture

| Component | Description |
|------------|-------------|
| **Frontend** | Web UI for upload/download and wallet connection |
| **Solana Program** | On-chain program handling file metadata, ownership, and chunk mappings |
| **IPFS Layer** | Decentralized storage for file chunks |

### 🔄 Data Flow

**Upload:**
1. User selects a file  
2. File is split into chunks  
3. Chunks are uploaded to IPFS  
4. IPFS hashes and file metadata are recorded on Solana  
5. File becomes retrievable anytime  

**Download:**
1. User requests a file  
2. Solana is queried for chunk hashes  
3. IPFS chunks are fetched  
4. File is reconstructed and downloaded
