import type { User } from './user';

export interface Room { 
    id: string;
    code: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    players?: User[];
}
