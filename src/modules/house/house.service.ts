import House, { IHouse } from '../../models/House'
import { CreateHouseDto, HouseResponse } from './house.dto'

export class HouseService {
    private mapToHouseResponse(house: IHouse): HouseResponse {
        return {
            id: (house._id as any).toString(),
            name: house.name,
            address: house.address,
            width: house.width,
            height: house.height,
            owner: house.owner.toString(),
            createdAt: (house as any).createdAt,
        };
    }

    //Tao nha nam moi kem chu so huu
    async createHouse(dto: CreateHouseDto, ownerId: string): Promise<HouseResponse> {
        const house = new House({
            ...dto,
            owner: ownerId,
        });

        const savedHouse = await house.save();
        return this.mapToHouseResponse(savedHouse);
    }

    // Lấy toàn bộ nhà nấm thuộc về chủ sở hữu cụ thể
    async getHousesByOwner(ownerId: string): Promise<HouseResponse[]> {
        const houses = await House.find({ owner: ownerId });
        return houses.map((house) => this.mapToHouseResponse(house));
    }
}