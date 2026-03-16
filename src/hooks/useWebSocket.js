import { useEffect, useRef } from 'react'

export function useWebSocket(url, onMessage) {
    const ws = useRef(null)
    const reconnectTimeout = useRef(null)
    const onMessageRef = useRef(onMessage)

    useEffect(() => {
        onMessageRef.current = onMessage
    }, [onMessage])

    useEffect(() => {
        const connect = () => {
            ws.current = new WebSocket(url)

            ws.current.onopen = () => {
                console.log(`WebSocket conectat: ${url}`)
            }

            ws.current.onmessage = (event) => {
                const data = JSON.parse(event.data)
                onMessageRef.current(data)
            }

            ws.current.onclose = () => {
                console.log('WebSocket deconectat, reconectare în 3s...')
                reconnectTimeout.current = setTimeout(connect, 3000)
            }

            ws.current.onerror = (error) => {
                console.error('WebSocket eroare:', error)
            }
        }

        connect()

        return () => {
            clearTimeout(reconnectTimeout.current)
            ws.current?.close()
        }
    }, [url])

    return ws
}