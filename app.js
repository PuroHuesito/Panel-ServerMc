document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const loginSection = document.getElementById('login-section');
    const controlSection = document.getElementById('control-section');
    const apiKeyInput = document.getElementById('api-key');
    const tunnelUrlInput = document.getElementById('tunnel-url');
    const btnLogin = document.getElementById('btn-login');
    const loginError = document.getElementById('login-error');
    
    const serverStatus = document.getElementById('server-status');
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnLogout = document.getElementById('btn-logout');
    const btnRefreshFiles = document.getElementById('btn-refresh-files');
    const fileList = document.getElementById('file-list');

    // State
    let apiKey = localStorage.getItem('mc_api_key') || '';
    let baseUrl = localStorage.getItem('mc_base_url') || '';

    // Init
    if (apiKey) {
        apiKeyInput.value = apiKey;
    }
    if (baseUrl) {
        tunnelUrlInput.value = baseUrl;
    }

    // Funciones de utilidad
    const getApiUrl = () => {
        let url = tunnelUrlInput.value.trim();
        // Fallback a localhost si está vacío
        if (!url) url = 'http://localhost:3001';
        // Quitar barra final si la tiene
        if (url.endsWith('/')) url = url.slice(0, -1);
        return url;
    };

    const fetchApi = async (endpoint, method = 'GET') => {
        const url = `${getApiUrl()}${endpoint}`;
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Error desconocido');
            }
            return data;
        } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            throw error;
        }
    };

    // Actualizar UI
    const updateStatusUI = (status) => {
        serverStatus.textContent = status === 'online' ? 'En línea' : 'Desconectado';
        serverStatus.className = `status-badge ${status}`;
        
        btnStart.disabled = status === 'online';
        btnStop.disabled = status !== 'online';
        
        if (status === 'online') {
            btnStart.style.opacity = '0.5';
            btnStart.style.cursor = 'not-allowed';
            btnStop.style.opacity = '1';
            btnStop.style.cursor = 'pointer';
        } else {
            btnStart.style.opacity = '1';
            btnStart.style.cursor = 'pointer';
            btnStop.style.opacity = '0.5';
            btnStop.style.cursor = 'not-allowed';
        }
    };

    const renderFiles = (files) => {
        fileList.innerHTML = '';
        // Ordenar: directorios primero
        files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

        files.forEach(file => {
            const li = document.createElement('li');
            const icon = file.isDirectory ? '📁' : '📄';
            const iconClass = file.isDirectory ? 'icon-folder' : 'icon-file';
            li.innerHTML = `<span class="${iconClass}">${icon}</span> ${file.name}`;
            fileList.appendChild(li);
        });
    };

    // Acciones principales
    const checkStatus = async () => {
        try {
            const data = await fetchApi('/api/status');
            updateStatusUI(data.status);
            return true;
        } catch (error) {
            if (error.message.includes('No autorizado') || error.message.includes('Failed to fetch')) {
                throw error;
            }
            updateStatusUI('offline');
            return true;
        }
    };

    const loadFiles = async () => {
        try {
            const data = await fetchApi('/api/files');
            renderFiles(data.files);
        } catch (error) {
            fileList.innerHTML = `<li><span style="color:var(--danger)">Error cargando archivos: ${error.message}</span></li>`;
        }
    };

    // Event Listeners
    btnLogin.addEventListener('click', async () => {
        apiKey = apiKeyInput.value.trim();
        const url = getApiUrl();
        
        if (!apiKey) {
            loginError.textContent = 'Por favor ingresa la clave secreta.';
            loginError.classList.remove('hidden');
            return;
        }

        btnLogin.textContent = 'Conectando...';
        btnLogin.disabled = true;

        try {
            // Intentar hacer ping al status para validar
            await checkStatus();
            
            // Si pasamos, guardar en storage y mostrar panel
            localStorage.setItem('mc_api_key', apiKey);
            localStorage.setItem('mc_base_url', tunnelUrlInput.value.trim());
            
            loginError.classList.add('hidden');
            loginSection.classList.remove('active');
            setTimeout(() => {
                controlSection.classList.add('active');
                loadFiles();
                // Polling cada 5 segundos
                window.statusInterval = setInterval(checkStatus, 5000);
            }, 300);
            
        } catch (error) {
            loginError.textContent = error.message === 'Failed to fetch' 
                ? 'No se pudo conectar al servidor. Verifica la URL y que tu PC esté encendida con ngrok activo.' 
                : error.message;
            loginError.classList.remove('hidden');
        } finally {
            btnLogin.textContent = 'Conectar';
            btnLogin.disabled = false;
        }
    });

    btnLogout.addEventListener('click', () => {
        clearInterval(window.statusInterval);
        localStorage.removeItem('mc_api_key');
        apiKeyInput.value = '';
        apiKey = '';
        
        controlSection.classList.remove('active');
        setTimeout(() => {
            loginSection.classList.add('active');
        }, 300);
    });

    btnStart.addEventListener('click', async () => {
        try {
            serverStatus.textContent = 'Iniciando...';
            serverStatus.className = 'status-badge loading';
            await fetchApi('/api/start', 'POST');
            setTimeout(checkStatus, 2000);
        } catch (error) {
            alert(`Error al iniciar: ${error.message}`);
            checkStatus();
        }
    });

    btnStop.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de detener el servidor?')) return;
        
        try {
            serverStatus.textContent = 'Deteniendo...';
            serverStatus.className = 'status-badge loading';
            await fetchApi('/api/stop', 'POST');
            setTimeout(checkStatus, 2000);
        } catch (error) {
            alert(`Error al detener: ${error.message}`);
            checkStatus();
        }
    });

    btnRefreshFiles.addEventListener('click', () => {
        fileList.innerHTML = '<li>Cargando...</li>';
        loadFiles();
    });
});
