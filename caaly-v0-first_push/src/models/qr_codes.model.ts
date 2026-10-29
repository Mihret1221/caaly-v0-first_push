import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";

@Entity("qr_codes")
export class QrCode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255, unique: true })
  qr_value!: string;

  @Column({ type: "varchar", length: 50 })
  device_id!: string; 

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;
}
