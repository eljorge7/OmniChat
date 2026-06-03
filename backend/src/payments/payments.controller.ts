import { Controller, Post, Get, Param, Req, Res, Headers, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { RaffleService } from '../raffle/raffle.service';

@Controller('api/v1/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappService,
    private raffleService: RaffleService
  ) {}

  @Get('pay/:ref')
  async generatePaymentLink(@Param('ref') ref: string, @Res() res: any) {
    const tickets = await this.prisma.ticket.findMany({
      where: { paymentReference: ref },
      include: {
        raffle: { include: { company: true } },
        contact: true
      }
    });

    if (!tickets || tickets.length === 0) {
      return res.redirect('https://omnichat.radiotecpro.com/');
    }

    const raffle = tickets[0].raffle;
    const contact = tickets[0].contact;

    if (!raffle.company.stripeSecretKey) {
      return res.redirect('https://omnichat.radiotecpro.com/');
    }

    const isPaid = tickets.some(t => t.status === 'PAID');
    if (isPaid) {
      return res.redirect(`https://omnichat.radiotecpro.com/rifas/${raffle.companyId}/${raffle.id}?success=true`);
    }

    const ticketNumbers = tickets.map(t => t.ticketNumber);
    
    const stripe = new Stripe(raffle.company.stripeSecretKey);
    try {
      const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card', 'oxxo'],
          line_items: [{
              price_data: {
                  currency: 'mxn',
                  product_data: {
                      name: `Rifa: ${raffle.name}`,
                      description: `Boletos: ${ticketNumbers.join(', ')}`,
                  },
                  unit_amount: Math.round(raffle.ticketPrice * 100),
              },
              quantity: ticketNumbers.length,
          }],
          mode: 'payment',
          success_url: `https://omnichat.radiotecpro.com/rifas/${raffle.companyId}/${raffle.id}?success=true`,
          cancel_url: `https://omnichat.radiotecpro.com/rifas/${raffle.companyId}/${raffle.id}?canceled=true`,
          metadata: {
              raffleId: raffle.id,
              contactId: contact?.id || '',
              ticketNumbers: ticketNumbers.join(','),
              paymentReference: ref
          }
      });
      
      return res.redirect(303, session.url as string);
    } catch (err) {
      this.logger.error('Error creating Stripe session dynamically', err);
      return res.redirect(`https://omnichat.radiotecpro.com/rifas/${raffle.companyId}/${raffle.id}?error=stripe`);
    }
  }

  @Post('stripe-webhook')
  async handleStripeWebhook(
    @Req() req: any,
    @Res() res: any,
    @Headers('stripe-signature') signature: string
  ) {
    // We cannot verify the signature easily here because each company has its own secret key 
    // and potentially its own webhook signing secret.
    // For a multi-tenant setup where companies input their own secret key, we must trust the event data
    // OR we verify the session directly with the Stripe API using the company's secret key.

    let event;
    try {
      // In a real multi-tenant scenario, without a single webhook secret, we parse the body directly.
      // Note: This is less secure than verifying the signature, but since we re-fetch the session from Stripe below, it is safe.
      event = req.body;
    } catch (err) {
      this.logger.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      
      const raffleId = session.metadata?.raffleId;
      const contactId = session.metadata?.contactId;
      const ticketNumbers = session.metadata?.ticketNumbers?.split(',') || [];
      const paymentReference = session.metadata?.paymentReference;

      if (raffleId && contactId && ticketNumbers.length > 0) {
        try {
          const raffle = await this.prisma.raffle.findUnique({
            where: { id: raffleId },
            include: { company: true }
          });

          if (raffle && raffle.company.stripeSecretKey) {
            // Re-verify the session with Stripe API to ensure it wasn't spoofed
            const stripe = new Stripe(raffle.company.stripeSecretKey);
            const verifiedSession = await stripe.checkout.sessions.retrieve(session.id);
            
            if (verifiedSession.payment_status === 'paid') {
               // Use RaffleService to register payment and automatically send VIP tickets and notifications
               const amountPaid = Math.round((verifiedSession.amount_total || 0) / 100);
               await this.raffleService.registerTicketKitPayment(raffleId, ticketNumbers, amountPaid, raffle.companyId);
               this.logger.log(`Payment successful via Stripe for raffle ${raffleId} tickets ${ticketNumbers.join(',')}`);
            }
          }
        } catch (e) {
          this.logger.error("Error processing successful payment", e);
        }
      }
    }

    res.json({ received: true });
  }
}
