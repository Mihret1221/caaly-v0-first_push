import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { User } from "../models/users.model.ts";

@Entity("otp_logs")
export class OtpLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  user_id!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "varchar", length: 6 })
  otp_code!: string;

  @Column({ type: "boolean", default: false })
  is_used!: boolean;

  @Column({ type: "timestamp" , nullable: true })
  expires_at?: Date;

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;
}
