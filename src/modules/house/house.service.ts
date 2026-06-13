import House, { IHouse } from '../../models/House'
import { CreateHouseDto, HouseResponse, UpdateHouseDto } from './house.dto'

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

    // Lấy chi tiết một nhà nấm theo ID và chủ sở hữu
    async getHouseById(houseId: string, ownerId: string): Promise<HouseResponse | null> {
        const house = await House.findOne({ _id: houseId, owner: ownerId });
        if (!house) return null;
        return this.mapToHouseResponse(house);
    }

    async updateHouse(houseId: string, ownerId : string, dto: UpdateHouseDto) {
        const updateHouse = await House.findOneAndUpdate(
            { _id : houseId, owner : ownerId },
            {$set : dto},
            { new : true }
        );

        if(!updateHouse) {
            throw new Error('Không tìm thấy nhà nấm hoặc bạn không có quyển cập nhật');
        }

        return this.mapToHouseResponse(updateHouse);
    }
}