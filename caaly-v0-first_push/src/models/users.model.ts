import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 20, unique: true })
  phone_number!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "varchar", length: 255, unique: true, nullable: true })
  email!: string | null;

  @Column({ type: "varchar", length: 255 })
  national_id!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  password_hash!: string | null;

  @Column({ type: "json", nullable: true })
  password_history!: string[] | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  gender!: string | null;

  @Column({ type: "date", nullable: true })
  date_of_birth!: Date | null;
  
  @Column({ type: "text" })
  kyc_photo!: string;

  @Column({ type: "json", nullable: true })
  address: { zone?: string; kebele?: string; region?: string; woreda?: string; } | null = null;

  @Column({ type: "boolean", default: false })
  kyc_status!: boolean;

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;

  @DeleteDateColumn({ type: "timestamp", nullable: true })
  deleted_at!: Date | null;
}