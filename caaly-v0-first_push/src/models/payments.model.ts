import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { Trip } from "./trips.model.ts";

@Entity("payments")
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  trip_id!: number;

  @ManyToOne(() => Trip)
  @JoinColumn({ name: "trip_id" })
  trip!: Trip;

  @Column({ 
    type: "enum", 
    enum: ["telebirr", "chapa"],
    default: "telebirr"
  })
  method!: "telebirr" | "chapa";

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount!: number;

  @Column({ 
    type: "enum", 
    enum: ["pending", "paid", "failed"],
    default: "pending"
  })
  status!: "pending" | "paid" | "failed";

  @Column({ type: "varchar", length: 255, nullable: true })
  reference!: string | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;
}