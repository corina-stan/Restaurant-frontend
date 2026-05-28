import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
})

api.interceptors.request.use((config) => {
    // Do not attach waiter/admin JWT tokens on client table pages to avoid 401s
    if (window.location.pathname.includes('/table/')) {
        return config
    }

    const token = sessionStorage.getItem('admin_token') ||
        sessionStorage.getItem('access_token') ||
        sessionStorage.getItem('kitchen_token') ||
        sessionStorage.getItem('bar_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            const isPublicOrLoginEndpoint =
                error.config.url.includes('/tables/scan/') ||
                error.config.url.includes('/orders/create/') ||
                error.config.url.includes('/menu/') ||
                error.config.url.includes('/orders/table/') ||
                error.config.url.includes('/token/')

            if (!isPublicOrLoginEndpoint) {
                const path = window.location.pathname
                if (path.startsWith('/kitchen')) {
                    sessionStorage.removeItem('kitchen_token')
                    localStorage.removeItem('kitchen_token')
                } else if (path.startsWith('/bar')) {
                    sessionStorage.removeItem('bar_token')
                    localStorage.removeItem('bar_token')
                } else if (path.startsWith('/admin')) {
                    sessionStorage.removeItem('admin_token')
                    localStorage.removeItem('admin_token')
                } else {
                    sessionStorage.removeItem('access_token')
                    sessionStorage.removeItem('refresh_token')
                    localStorage.removeItem('access_token')
                    localStorage.removeItem('refresh_token')
                    window.location.href = '/waiter'
                }
            }
        }
        return Promise.reject(error)
    }
)

export const getTokenRole = () => {
    const token = sessionStorage.getItem('admin_token') ||
        sessionStorage.getItem('access_token') ||
        sessionStorage.getItem('kitchen_token') ||
        sessionStorage.getItem('bar_token') ||
        localStorage.getItem('access_token') ||
        localStorage.getItem('kitchen_token') ||
        localStorage.getItem('bar_token')
    if (!token) return null
    try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return payload.role
    } catch {
        return null
    }
}

export const decodeToken = (token) => {
    try {
        return JSON.parse(atob(token.split('.')[1]))
    } catch {
        return null
    }
}

export default api