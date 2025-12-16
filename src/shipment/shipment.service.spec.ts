import { Test, TestingModule } from '@nestjs/testing';
import { ShipmentService } from './shipment.service';
import { PrismaService } from '../prisma/prisma.service';
import { CourierService } from 'src/courier/courier.service';
import { ShipmentStatus } from 'src/generated/prisma/enums';
import { CreateWaybillReqDto } from 'src/courier/dto/create-waybill.req.dto';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

describe('ShipmentService', () => {
  let service: ShipmentService;
  let prisma: PrismaService;
  let courierService: CourierService;

  const mockPrismaService = {
    shipment: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockCourierAdapter = {
    providerId: 'test-courier',
    capabilities: {
      cancellation: true,
      printLabel: true,
    },
    createWaybill: jest.fn(),
    trackShipment: jest.fn(),
    getLabel: jest.fn(),
    cancelShipment: jest.fn(),
    mapStatus: jest.fn(),
  };

  const mockCourierService = {
    getAdapter: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CourierService, useValue: mockCourierService },
      ],
    }).compile();

    service = module.get<ShipmentService>(ShipmentService);
    prisma = module.get<PrismaService>(PrismaService);
    courierService = module.get<CourierService>(CourierService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createShipment', () => {
    const dto: CreateWaybillReqDto = {
      orderReference: 'ORD-123',
      sender: {
        name: 'Sender',
        phone: '123',
        address: 'Addr',
        city: 'City',
        countryCode: 'SA',
      },
      receiver: {
        name: 'Receiver',
        phone: '456',
        address: 'Addr2',
        city: 'City2',
        countryCode: 'SA',
      },
      dimensions: { weight: 1 },
    };

    const createdShipment = {
      id: 'ship-1',
      status: ShipmentStatus.PENDING,
    };

    it('should successfully create a shipment', async () => {
      // Arrange
      mockCourierService.getAdapter.mockReturnValue(mockCourierAdapter);
      mockPrismaService.shipment.create.mockResolvedValue(createdShipment);

      const apiResponse = {
        trackingNumber: 'TRK-123',
        courierRef: 'REF-123',
        labelUrl: 'http://label.url',
      };
      mockCourierAdapter.createWaybill.mockResolvedValue(apiResponse);

      const updatedShipment = {
        ...createdShipment,
        status: ShipmentStatus.CREATED,
        ...apiResponse,
      };
      mockPrismaService.shipment.update.mockResolvedValue(updatedShipment);

      // Act
      const result = await service.createShipment('test-courier', dto);

      // Assert
      expect(mockCourierService.getAdapter).toHaveBeenCalledWith('test-courier');
      expect(mockPrismaService.shipment.create).toHaveBeenCalled();
      expect(mockCourierAdapter.createWaybill).toHaveBeenCalledWith(dto);
      expect(mockPrismaService.shipment.update).toHaveBeenCalledWith({
        where: { id: 'ship-1' },
        data: expect.objectContaining({
          status: ShipmentStatus.CREATED,
          trackingNumber: 'TRK-123',
        }),
      });
      expect(result).toEqual(updatedShipment);
    });

    it('should mark shipment as FAILED if adapter throws error', async () => {
      // Arrange
      mockCourierService.getAdapter.mockReturnValue(mockCourierAdapter);
      mockPrismaService.shipment.create.mockResolvedValue(createdShipment);
      mockCourierAdapter.createWaybill.mockRejectedValue(
        new Error('API Error'),
      );

      // Act & Assert
      await expect(service.createShipment('test-courier', dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPrismaService.shipment.update).toHaveBeenCalledWith({
        where: { id: 'ship-1' },
        data: { status: ShipmentStatus.FAILED },
      });
    });
  });

  describe('trackShipment', () => {
    it('should throw NotFoundException if shipment does not exist', async () => {
      mockPrismaService.shipment.findUnique.mockResolvedValue(null);
      await expect(service.trackShipment('TRK-404')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update shipment status if changed', async () => {
      const shipment = {
        id: 'ship-1',
        trackingNumber: 'TRK-123',
        courierId: 'test-courier',
        status: ShipmentStatus.CREATED,
      };
      mockPrismaService.shipment.findUnique.mockResolvedValue(shipment);
      mockCourierService.getAdapter.mockReturnValue(mockCourierAdapter);

      const trackingRes = {
        currentStatus: ShipmentStatus.DELIVERED,
        events: [],
        trackingNumber: 'TRK-123',
      };
      mockCourierAdapter.trackShipment.mockResolvedValue(trackingRes);

      await service.trackShipment('TRK-123');

      expect(mockPrismaService.shipment.update).toHaveBeenCalledWith({
        where: { id: shipment.id },
        data: { status: ShipmentStatus.DELIVERED },
      });
    });
  });

  describe('cancelShipment', () => {
    it('should throw BadRequestException if already delivered', async () => {
      const shipment = { id: 'ship-1', status: ShipmentStatus.DELIVERED };
      mockPrismaService.shipment.findUnique.mockResolvedValue(shipment);

      await expect(service.cancelShipment('TRK-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw UnprocessableEntityException if capability missing', async () => {
      const shipment = {
        id: 'ship-1',
        status: ShipmentStatus.CREATED,
        courierId: 'no-cancel',
      };
      mockPrismaService.shipment.findUnique.mockResolvedValue(shipment);

      const noCancelAdapter = {
        ...mockCourierAdapter,
        capabilities: { cancellation: false },
      };
      mockCourierService.getAdapter.mockReturnValue(noCancelAdapter);

      await expect(service.cancelShipment('TRK-123')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should successfully cancel a shipment', async () => {
      const shipment = {
        id: 'ship-1',
        status: ShipmentStatus.CREATED,
        courierId: 'test-courier',
      };
      mockPrismaService.shipment.findUnique.mockResolvedValue(shipment);
      mockCourierService.getAdapter.mockReturnValue(mockCourierAdapter);
      mockCourierAdapter.cancelShipment.mockResolvedValue(true);

      await service.cancelShipment('TRK-123');

      expect(mockPrismaService.shipment.update).toHaveBeenCalledWith({
        where: { id: shipment.id },
        data: { status: ShipmentStatus.CANCELLED },
      });
    });
  });
});
