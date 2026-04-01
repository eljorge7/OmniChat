import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // Permitir conexión desde Next.js localhost:3000
  },
})
export class WhatsappGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('WhatsappGateway');

  afterInit(server: Server) {
    this.logger.log('WebSockets Iniciados. Escuchando clientes UI...');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Frontend Conectado (OmniChat Panel): ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Frontend Desconectado: ${client.id}`);
  }

  // Métodos que llamará el WhatsappService para escupir datos al frontend
  emitNewMessage(messageData: any) {
    this.server.emit('newMessage', messageData);
  }

  emitContactRouted(contactData: any) {
    this.server.emit('contactRouted', contactData);
  }
}
