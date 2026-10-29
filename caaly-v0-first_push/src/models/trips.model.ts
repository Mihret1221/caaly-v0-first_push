import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { User } from "../models/users.model.ts";

@Entity("trips")
export class Trip {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  user_id!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "varchar", length: 50 })
  device_id!: string;

  @Column({ type: "timestamp" })
  start_time!: Date;

  @Column({ type: "timestamp", nullable: true })
  end_time!: Date | null;

  @Column({ type: "int", nullable: true })
  total_minutes!: number | null;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  fare_rate!: number | null;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  total_fare!: number | null;

  @Column({ type: "int", nullable: true })
  payment_id!: number | null;
}