# microBlock IDE (Offline Version)

Offline desktop version of the microBlock IDE.

**Current Version:** v3.1.0-beta.2  
**Compatible OS:** Windows 10 or later, macOS (Apple Silicon), Linux

## Getting Started

### 1. Clone the project
```bash
git clone --recurse-submodules https://github.com/microBlock-IDE/microBlock-IDE-offline.git
cd microBlock-IDE-offline
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