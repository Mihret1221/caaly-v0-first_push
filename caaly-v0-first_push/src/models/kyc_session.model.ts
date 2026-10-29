import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
// import { User } from "./users.model.js";

@Entity("kyc_sessions")
export class KycSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255, unique: true })
  state!: string;

  @Column({ type: "varchar", length: 255 })
  codeVerifier!: string;

  @Column({ type: "varchar", length: 255 })
  nonce!: string;

  // @Column({ type: "int", nullable: true })
  // user_id!: number | null;

  // @ManyToOne(() => User, { nullable: true })
  // @JoinColumn({ name: "user_id" })
  // user!: User | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at!: Date;
}
