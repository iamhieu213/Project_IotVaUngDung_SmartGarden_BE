import { z } from 'zod'

export const CreateHouseSchema = z.object({
  name: z.string().min(1, 'Tên nhà nấm không được để trống'),
  address: z.string().min(1, 'Địa chỉ không được để trống'),
  width: z.number().nonnegative('Chiều rộng phải lớn hơn hoặc bằng 0').optional(),
  height: z.number().nonnegative('Chiều cao/dài phải lớn hơn hoặc bằng 0').optional(),
});

export type CreateHouseDto = z.infer<typeof CreateHouseSchema>

export interface HouseResponse {
    id: string;
    name: string;
    address: string;
    width: number;
    height: number;
    owner: string;
    createdAt: Date;
}

export const UpdateHouseSchema = z.object({
  name : z.string().min(1, 'Tên nhà nấm không được để trống').optional(),
  address: z.string().min(1, 'Địa chỉ không được để trống').optional(),
  width: z.number().nonnegative('Chiều rộng phải lớn hơn hoặc bằng 0').optional(),
  height: z.number().nonnegative('Chiều cao/dài phải lớn hơn hoặc bằng 0').optional(),
});

export type UpdateHouseDto = z.infer<typeof UpdateHouseSchema>