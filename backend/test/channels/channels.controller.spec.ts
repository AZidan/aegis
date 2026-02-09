import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsController } from '../../src/channels/channels.controller';
import { ChannelConnectionService } from '../../src/channels/channel-connection.service';
import { ChannelRoutingService } from '../../src/channels/channel-routing.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../src/common/guards/tenant.guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';
const CONNECTION_ID = 'conn-1';
const RULE_ID = 'rule-1';

const mockRequest = (tenantId = TENANT_ID, userId = USER_ID) =>
  ({
    tenantId,
    user: { sub: userId },
  }) as any;

// ---------------------------------------------------------------------------
// Test Suite: ChannelsController
// ---------------------------------------------------------------------------
describe('ChannelsController', () => {
  let controller: ChannelsController;
  let connectionService: {
    listConnections: jest.Mock;
    createConnection: jest.Mock;
    getConnection: jest.Mock;
    updateConnection: jest.Mock;
    deleteConnection: jest.Mock;
  };
  let routingService: {
    listRoutes: jest.Mock;
    createRoute: jest.Mock;
    updateRoute: jest.Mock;
    deleteRoute: jest.Mock;
  };

  beforeEach(async () => {
    connectionService = {
      listConnections: jest.fn(),
      createConnection: jest.fn(),
      getConnection: jest.fn(),
      updateConnection: jest.fn(),
      deleteConnection: jest.fn(),
    };
    routingService = {
      listRoutes: jest.fn(),
      createRoute: jest.fn(),
      updateRoute: jest.fn(),
      deleteRoute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelsController],
      providers: [
        { provide: ChannelConnectionService, useValue: connectionService },
        { provide: ChannelRoutingService, useValue: routingService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ChannelsController>(ChannelsController);
  });

  // =========================================================================
  // Connection Endpoints
  // =========================================================================
  describe('listConnections()', () => {
    it('should call connectionService.listConnections with tenantId', async () => {
      const expected = [{ id: CONNECTION_ID }];
      connectionService.listConnections.mockResolvedValue(expected);

      const result = await controller.listConnections(mockRequest());

      expect(connectionService.listConnections).toHaveBeenCalledWith(TENANT_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('createConnection()', () => {
    it('should call connectionService.createConnection with dto, tenantId, userId', async () => {
      const dto = { platform: 'SLACK', workspaceId: 'W1', workspaceName: 'WS' };
      const expected = { id: 'new-conn' };
      connectionService.createConnection.mockResolvedValue(expected);

      const result = await controller.createConnection(mockRequest(), dto as any);

      expect(connectionService.createConnection).toHaveBeenCalledWith(
        dto,
        TENANT_ID,
        USER_ID,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getConnection()', () => {
    it('should call connectionService.getConnection with id and tenantId', async () => {
      const expected = { id: CONNECTION_ID };
      connectionService.getConnection.mockResolvedValue(expected);

      const result = await controller.getConnection(mockRequest(), CONNECTION_ID);

      expect(connectionService.getConnection).toHaveBeenCalledWith(
        CONNECTION_ID,
        TENANT_ID,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('updateConnection()', () => {
    it('should call connectionService.updateConnection with id, dto, tenantId, userId', async () => {
      const dto = { workspaceName: 'Updated' };
      const expected = { id: CONNECTION_ID, workspaceName: 'Updated' };
      connectionService.updateConnection.mockResolvedValue(expected);

      const result = await controller.updateConnection(
        mockRequest(),
        CONNECTION_ID,
        dto as any,
      );

      expect(connectionService.updateConnection).toHaveBeenCalledWith(
        CONNECTION_ID,
        dto,
        TENANT_ID,
        USER_ID,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('deleteConnection()', () => {
    it('should call connectionService.deleteConnection with id, tenantId, userId', async () => {
      const expected = { deleted: true };
      connectionService.deleteConnection.mockResolvedValue(expected);

      const result = await controller.deleteConnection(
        mockRequest(),
        CONNECTION_ID,
      );

      expect(connectionService.deleteConnection).toHaveBeenCalledWith(
        CONNECTION_ID,
        TENANT_ID,
        USER_ID,
      );
      expect(result).toEqual(expected);
    });
  });

  // =========================================================================
  // Routing Endpoints
  // =========================================================================
  describe('listRoutes()', () => {
    it('should call routingService.listRoutes with connectionId and tenantId', async () => {
      const expected = [{ id: RULE_ID }];
      routingService.listRoutes.mockResolvedValue(expected);

      const result = await controller.listRoutes(mockRequest(), CONNECTION_ID);

      expect(routingService.listRoutes).toHaveBeenCalledWith(
        CONNECTION_ID,
        TENANT_ID,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('createRoute()', () => {
    it('should call routingService.createRoute with connectionId, dto, tenantId, userId', async () => {
      const dto = { agentId: 'a1', routeType: 'channel_mapping', sourceIdentifier: '#gen' };
      const expected = { id: 'new-rule' };
      routingService.createRoute.mockResolvedValue(expected);

      const result = await controller.createRoute(
        mockRequest(),
        CONNECTION_ID,
        dto as any,
      );

      expect(routingService.createRoute).toHaveBeenCalledWith(
        CONNECTION_ID,
        dto,
        TENANT_ID,
        USER_ID,
      );
      expect(result).toEqual(expected);
    });
  });

  // =========================================================================
  // Guard Verification
  // =========================================================================
  describe('Guard metadata', () => {
    it('should have JwtAuthGuard and TenantGuard applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', ChannelsController);

      expect(guards).toBeDefined();
      expect(guards).toHaveLength(2);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(TenantGuard);
    });
  });
});
