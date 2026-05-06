

/**
 * Envoie une requette au server proxy
 * @param url 
 * @param req 
 * @returns 
 */
export async function fetchProxy(urlEndpoint:string, req:Record<string, any>){
    const urlProxy:string = import.meta.env.VITE_URL_PROXY
    const url:string= `${urlProxy}${urlEndpoint}`
    const res = await fetch(url, req)
    return res
}