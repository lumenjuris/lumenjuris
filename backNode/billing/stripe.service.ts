import Stripe from 'stripe';



export class StripeLumenJuris {

    async createCustomer(email: string, name: string) {
        try {
            const stripeClient = new Stripe(process.env.STRIPE_SK!, {
                maxNetworkRetries: 2,
                telemetry: process.env.NODE_ENV == "dev" ? true : false
            })

            const params: Stripe.CustomerCreateParams = {
                description: 'test customer',
                email,
                name
            }

            const customer: Stripe.Customer = await stripeClient.customers.create(params)
            console.log(customer)
            const id = customer.id
            return {
                success: !!id,
                message: id ? "Le nouveau client a été créé dans stripe avec succès" : "Echec, le client stripe n'a pas pu être créé",
                customerId: id
            }
        } catch (err) {
            console.error(`Une erreur est survenue lors de la création d'un customer stripe, error : \n ${err}`)
            return {
                success: false,
                message: "Une erreur est survenue lors de la création d'un customer stripe"
            }
        }
    }


    async createPayementIntent(customerId: string, amount: number, autmaticPayment: boolean) {
        try {
            const stripeClient = new Stripe(process.env.STRIPE_SK!, {
                maxNetworkRetries: 2,
                telemetry: process.env.NODE_ENV == "dev" ? true : false
            })
            const paymentIntent = await stripeClient.paymentIntents.create({
                amount: amount,
                currency: "eur",
                automatic_payment_methods: {
                    enabled: autmaticPayment
                },
                customer: customerId

            })

            console.log(paymentIntent)
            const id = paymentIntent.id
            return {
                success: !!id,
                clientSecret: paymentIntent.client_secret,
                message: id
                    ? "Le payment intent a été créé avec succès."
                    : "Le payment intent n'a pas pu être créé.",
                
            }
        } catch (err) {
            console.error(`Une erreur est survenue lors de la creation d'un payment intent, error : \n ${err}`)
            return {
                success: false,
                message: "Une erreur est survenue lors de la creation d'un payment intent"
            }
        }
    }


    async confirmPaymentIntent() {
        try {

        } catch (err) {
            console.error(`Une erreur est survenue lors de la confirmation du payment intent, error :\n ${err}`)
            return {
                success: false,
                message: "Une erreur est survenue lors de la confirmation du payment intent"
            }
        }
    }
}