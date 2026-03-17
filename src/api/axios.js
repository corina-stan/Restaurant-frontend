import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
})

api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('access_token') ||
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
            const isPublicEndpoint =
                error.config.url.includes('/tables/scan/') ||
                error.config.url.includes('/orders/create/') ||
                error.config.url.includes('/menu/') ||
                error.config.url.includes('/orders/table/')

            if (!isPublicEndpoint) {
                localStorage.removeItem('access_token')
                localStorage.removeItem('refresh_token')
                window.location.href = '/waiter'
            }
        }
        return Promise.reject(error)
    }
)

export const getTokenRole = () => {
    const token = localStorage.getItem('access_token') ||
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