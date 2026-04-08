declare global {
  namespace Express {
    interface Request {
      idUser?: string
      role?:string
    }
  }
}

export {}