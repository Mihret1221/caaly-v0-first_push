import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("settings")
export class Setting{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    fare_rate!: number;

    @Column({ type: "varchar", length: 50 })
    payment_provider!: string;

    @CreateDateColumn({ type: "timestamp" })
    created_at!: Date;
}