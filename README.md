# microBlock IDE (Offline Version)

Offline desktop version of the microBlock IDE.

**Current Version:** V3.1.1  
**Compatible OS:** Windows 10 or later, macOS (Apple Silicon), Linux

We recommend using **Node.js v12.22.12** via `nvm` to develop this repository.

```bash
nvm install 12.22.12
nvm use 12.22.12
```
## Getting Started

### 1. Clone the project
```bash
git clone https://github.com/inexglobal/microBlock-IDE.git
cd microBlock-IDE
```

### 2. Create a Python 3.10 virtual environment
```bash
python3.10 -m venv venv
```

### 3. Activate the virtual environment

#### Linux / macOS
```bash
source venv/bin/activate
```

#### Windows (Command Prompt)
```cmd
venv\Scripts\activate
```

#### Windows (PowerShell)
```powershell
venv\Scripts\Activate.ps1
```

### 4. Install `electron-rebuild`
```bash
npm install --save-dev electron-rebuild
```

### 5. Install the dependencies
```bash
npm install
```

### 6. Run the program
```bash
npm start
```
