import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("admins")
export class Admin{
    @PrimaryGeneratedColumn()
    id!: number;
    @Column({ type: "varchar", length: 100 })
    name!: string;
    @Column({ type: "varchar", length: 100 })
    email!: string;
    @Column({ type: "varchar", length: 100 })
    password_hash!: string;
    @Column({ type: "json", nullable: true })
  password_history!: string[] | null;
    @Column({ 
    type: "enum", 
    enum: ["admin", "subadmin" , "superadmin"],
    default: "admin"
  })
    role!: "admin" | "subadmin" | "superadmin";

    @CreateDateColumn({ type: "timestamp" })
    created_at!: Date;
}